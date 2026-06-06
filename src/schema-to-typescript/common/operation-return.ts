import { booleanLiteral, callExpression, identifier, memberExpression, numericLiteral, objectExpression, objectProperty, stringLiteral, thisExpression, tsLiteralType, tsPropertySignature, tsQualifiedName, tsTypeAnnotation, tsTypeLiteral, tsTypeParameterInstantiation, tsTypeReference, tsUnionType, tsUnknownKeyword, tsVoidKeyword } from '../../emit/index.ts';
import type { Expression, TSType } from '../../emit/index.ts';
import type { GetModelData } from './models.ts';
import type { OpenApiMediaType, OpenApiOperation, OpenApiResponse } from '../../schemas/openapi.ts';
import { extendDependenciesAndGetResult, generateSchemaTypeAndImports } from '../../utils/dependencies.ts';
import type { DependencyImports } from '../../utils/dependencies.ts';
import {extractJsDoc, renderJsDocAsPlainText, renderJsDocList} from '../../utils/jsdoc.ts';
import {isJsonMediaType} from '../../utils/media-types.ts';
import {applyEntityNameCase, ucFirst} from '../../utils/string-utils.ts';
import {getUserFreiendlySchemaName, simplifyUnionTypeIfPossible} from '../../utils/type-utils.ts';
import type { OpenApiClientBuiltinBinaryType } from '../openapi-to-typescript-client.ts';

export type ResultWrapper = (expression: Expression) => Expression;

export interface OperationReturnType {
    type: TSType;
    dependencyImports: DependencyImports;
    suggestedDescription: string;
    wrapResultExpression: ResultWrapper;
}

const combineResultWrappers =
    (wrappers: ResultWrapper[]): ResultWrapper =>
    (expression: Expression): Expression => {
        let result = expression;
        for (const wrapper of wrappers) {
            result = wrapper(result);
        }
        return result;
    };

type MediaTypesDistribution = Record<string, Record<string, 'json' | 'blob' | 'readableStream'>>;

export function getOperationReturnType({
    operation,
    getModelData,
    operationImportPath,
    commonHttpClientImportName,
    binaryType
}: {
    commonHttpClientImportName: string;
    operation: OpenApiOperation;
    getModelData: GetModelData;
    operationImportPath: string;
    binaryType: OpenApiClientBuiltinBinaryType;
}): OperationReturnType {
    const getResponseBody = (expression: Expression) =>
        callExpression(memberExpression(expression, identifier('then')), [
            memberExpression(identifier(commonHttpClientImportName), identifier('getBody'))
        ]);

    const discardResponseType = (expression: Expression) =>
        callExpression(memberExpression(expression, identifier('then')), [
            memberExpression(identifier(commonHttpClientImportName), identifier('discardResult'))
        ]);

    const applyCreatedResultTypeShortcut = (keyCreated: string, keyOther: string) => (expression: Expression) =>
        callExpression(memberExpression(expression, identifier('then')), [
            callExpression(memberExpression(identifier(commonHttpClientImportName), identifier('asCreatedResponse')), [
                stringLiteral(keyCreated),
                ...(keyCreated === keyOther ? [] : [stringLiteral(keyOther)])
            ])
        ]);

    const castResponseType = (responseType: TSType) => (expression: Expression) =>
        callExpression(
            memberExpression(expression, identifier('then')),
            [
                callExpression(
                    memberExpression(identifier(commonHttpClientImportName), identifier('castResponse')),
                    [],
                    tsTypeParameterInstantiation([responseType])
                )
            ]
        );

    const responseHandler = (mediaTypesDistribution: MediaTypesDistribution) => (expression: Expression) =>
        callExpression(memberExpression(expression, identifier('then')), [
            callExpression(
                memberExpression(
                    callExpression(memberExpression(thisExpression(), identifier('getClientInstance')), []),
                    identifier('responseHandler')
                ),
                [
                    objectExpression(
                        Object.entries(mediaTypesDistribution).map(([status, mediaTypes]) =>
                            objectProperty(
                                numericLiteral(parseInt(status, 10)),
                                objectExpression(
                                    Object.entries(mediaTypes).map(([mediaType, bodyType]) =>
                                        objectProperty(stringLiteral(mediaType), stringLiteral(bodyType))
                                    )
                                )
                            )
                        )
                    )
                ]
            )
        ]);

    if (!operation.responses) {
        return {
            type: tsVoidKeyword(),
            dependencyImports: {},
            suggestedDescription: '',
            wrapResultExpression: discardResponseType
        };
    }
    const successfulResponses: {
        status: string;
        response: OpenApiResponse;
        mediaTypeString: string;
        mediaType: OpenApiMediaType;
    }[] = [];
    const statuses: Record<string, true> = {};
    const dependencyImports: DependencyImports = {};
    const mediaTypesDistribution: MediaTypesDistribution = {};
    for (const [status, response] of Object.entries(operation.responses ?? [])) {
        if (status.charAt(0) === '2') {
            statuses[status] = true;
            mediaTypesDistribution[status] = {};
            for (const [mediaTypeString, mediaType] of Object.entries(response.content ?? [])) {
                mediaTypesDistribution[status][mediaTypeString] = isJsonMediaType(mediaTypeString)
                    ? 'json'
                    : binaryType;
                successfulResponses.push({status, mediaTypeString, response, mediaType});
            }
        }
    }
    if (successfulResponses.length === 0) {
        return {
            type: tsVoidKeyword(),
            dependencyImports: {},
            suggestedDescription: '',
            wrapResultExpression: discardResponseType
        };
    }
    const resultTypes: TSType[] = [];
    const suggestedDescriptionFragments: string[] = [];
    const responseTypes: TSType[] = [];

    const useAsCreatedResponseShortcut = successfulResponses.length === 2 && statuses[200] && statuses[201];
    let keyCreated = 'body';
    let keyOther = 'other';

    const getBinaryType = () => tsTypeReference(identifier(ucFirst(binaryType)));

    for (const {status, mediaTypeString, mediaType, response} of successfulResponses) {
        let schemaType: TSType;
        if (isJsonMediaType(mediaTypeString)) {
            if (mediaType.schema !== undefined) {
                schemaType = extendDependenciesAndGetResult(
                    generateSchemaTypeAndImports({
                        schema: mediaType.schema,
                        sourceImportPath: operationImportPath,
                        getModelData,
                        getBinaryType
                    }),
                    dependencyImports
                );
            } else {
                schemaType = tsUnknownKeyword();
            }
        } else {
            schemaType = tsTypeReference(identifier('Blob'));
        }
        if (status === '204') {
            schemaType = tsVoidKeyword();
        }
        const jsdocString = renderJsDocAsPlainText(extractJsDoc({...response, ...mediaType}));
        const responseOption = tsTypeLiteral([
            tsPropertySignature(identifier('status'), tsTypeAnnotation(tsLiteralType(numericLiteral(parseInt(status, 10))))),
            tsPropertySignature(identifier('mediaType'), tsTypeAnnotation(tsLiteralType(stringLiteral(mediaTypeString)))),
            tsPropertySignature(identifier('body'), tsTypeAnnotation(schemaType))
        ]);
        responseTypes.push(responseOption);
        if (successfulResponses.length > 1) {
            suggestedDescriptionFragments.push(
                `status: ${status}, mediaType: ${mediaTypeString}${jsdocString ? `\n\n${jsdocString}` : ''}`
            );
            if (useAsCreatedResponseShortcut) {
                const fieldName = applyEntityNameCase(
                    getUserFreiendlySchemaName(mediaType.schema) ?? 'body',
                    'camelCase'
                );
                const created = status === '201';
                if (created) {
                    keyCreated = fieldName;
                } else {
                    keyOther = fieldName;
                }
                resultTypes.push(
                    tsTypeLiteral([
                        tsPropertySignature(
                            identifier('created'),
                            tsTypeAnnotation(tsLiteralType(booleanLiteral(created)))
                        ),
                        tsPropertySignature(identifier(fieldName), tsTypeAnnotation(schemaType))
                    ])
                );
            } else {
                resultTypes.push(responseOption);
            }
        } else {
            return {
                type: schemaType,
                dependencyImports,
                suggestedDescription: jsdocString ?? '',
                wrapResultExpression: combineResultWrappers([
                    responseHandler(mediaTypesDistribution),
                    castResponseType(tsUnionType(responseTypes)),
                    getResponseBody
                ])
            };
        }
    }

    const simplifiedResponseType = simplifyUnionTypeIfPossible(tsUnionType(responseTypes));
    const simplifiedResultType = simplifyUnionTypeIfPossible(tsUnionType(resultTypes));

    return {
        type: useAsCreatedResponseShortcut
            ? simplifiedResultType
            : tsTypeReference(
                  tsQualifiedName(identifier(commonHttpClientImportName), identifier('WithResponse')),
                  tsTypeParameterInstantiation([simplifiedResultType])
              ),
        dependencyImports,
        suggestedDescription: '\n' + renderJsDocList(suggestedDescriptionFragments),
        wrapResultExpression: combineResultWrappers([
            responseHandler(mediaTypesDistribution),
            castResponseType(simplifiedResponseType),
            useAsCreatedResponseShortcut
                ? applyCreatedResultTypeShortcut(keyCreated, keyOther)
                : (expression) => expression
        ])
    };
}
