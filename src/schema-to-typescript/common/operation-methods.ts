import { arrowFunctionExpression, assignmentPattern, blockStatement, callExpression, classProperty, identifier, isValidIdentifier, memberExpression, objectExpression, objectPattern, objectPatternProperty, objectProperty, returnStatement, setArrowFunctionReturnType, stringLiteral, thisExpression, tsLiteralType, tsPropertySignature, tsStringKeyword, tsTypeAnnotation, tsTypeLiteral, tsTypeParameterInstantiation, tsTypeReference, tsUndefinedKeyword, tsUnionType } from '../../emit/index.ts';
import type { ClassProperty, Expression, Identifier, TSType } from '../../emit/index.ts';
import ts from 'typescript';
import {uniq} from '../../utils/collections.ts';
import {generateBinaryType} from './binary.ts';
import type { GetModelData } from './models.ts';
import {getOperationReturnType} from './operation-return.ts';
import type { OpenApiParameter, OpenApiSchema } from '../../schemas/common.ts';
import { openApiHttpMethods } from '../../schemas/openapi.ts';
import type { OpenApiMediaType, OpenApiOperation, OpenApiPathItem, OpenApiPaths, OpenApiRequestBody } from '../../schemas/openapi.ts';
import { extendDependenciesAndGetResult, extendDependencyImports, generateSchemaTypeAndImports } from '../../utils/dependencies.ts';
import type { DependencyImports } from '../../utils/dependencies.ts';
import { attachJsDocComment, extractJsDoc, renderJsDoc } from '../../utils/jsdoc.ts';
import type { JsDocRenderConfig } from '../../utils/jsdoc.ts';
import {isJsonMediaType, isWildcardMediaType} from '../../utils/media-types.ts';
import {buildParametersSerializationInfo} from '../../utils/parameter-serialization-styles.ts';
import {applyEntityNameCase} from '../../utils/string-utils.ts';
import {getUserFreiendlySchemaName, isAssignableToEmptyObject, mergeTypes} from '../../utils/type-utils.ts';
import {objectPropertyKey, valueToAstExpression} from '../common.ts';
import type { OpenApiClientCustomizableBinaryType, OpenApiClientGeneratorConfig } from '../openapi-to-typescript-client.ts';

const parametersSortTable = {
    path: 0,
    query: 1,
    header: 2,
    cookie: 3
};
function sortParameters(parameters: OpenApiParameter[]) {
    return parameters.concat().sort((a, b) => parametersSortTable[a.in] - parametersSortTable[b.in]);
}

function generateUniqueName(source: string, postfixes: string[], usedNames: Record<string, true>) {
    let result = applyEntityNameCase(source, 'camelCase');
    if (!result && isValidIdentifier(source)) {
        result = source;
    }
    if (!usedNames[result]) {
        return result;
    }
    for (const postfix of postfixes) {
        const result = applyEntityNameCase(`${source} ${postfix}`, 'camelCase');
        if (result && !usedNames[result]) {
            return result;
        }
    }
    let i = 0;
    const baseName =
        applyEntityNameCase(source, 'camelCase') || (isValidIdentifier(source) ? source : postfixes[0]) || 'param';
    while (usedNames[result]) {
        i++;
        result = applyEntityNameCase(`${baseName} ${i}`, 'camelCase');
    }
    return result;
}

interface OpenApiParameterFromArgument {
    paramName: string;
    argumentName: string;
    destructuringName: string;
    defaultValue?: Expression;
    optional?: boolean;
    docs: string | null;
    type?: TSType;
}

interface OpenApiParameterValue {
    paramName: string;
    value: Expression;
}

type OperationInputParameterLocation = Exclude<OpenApiParameter['in'], 'cookie'> | 'body';
type OperationInputParameters = {
    [K in OperationInputParameterLocation]: (OpenApiParameterFromArgument | OpenApiParameterValue)[];
};
type GenerateOperationParameterArgumentName = NonNullable<
    OpenApiClientGeneratorConfig['operations']
>['generateOperationParameterArgumentName'];
type GenerateOperationParameterJsDoc = NonNullable<
    OpenApiClientGeneratorConfig['operations']
>['generateOperationParameterJsDoc'];
type GenerateOperationRequestBodyArgumentName = NonNullable<
    OpenApiClientGeneratorConfig['operations']
>['generateOperationRequestBodyArgumentName'];
type GenerateOperationRequestBodyJsDoc = NonNullable<
    OpenApiClientGeneratorConfig['operations']
>['generateOperationRequestBodyJsDoc'];
type MediaTypeArgumentName = NonNullable<OpenApiClientGeneratorConfig['operations']>['mediaTypeArgumentName'];

interface OperationMethodContext {
    operation: OpenApiOperation;
    pathItem: OpenApiPathItem;
    path: string;
    serviceName?: string;
    httpMethod: string;
    operationName: string;
}

interface SchemaTypeContext {
    getModelData: GetModelData;
    operationImportPath: string;
    getBinaryType: () => TSType;
    dependencyImports: DependencyImports;
}

interface JsDocContext {
    jsDocRenderConfig: JsDocRenderConfig;
}

type OperationMethodSchemaContext = OperationMethodContext & SchemaTypeContext & JsDocContext;

function createOperationInputParameters(): OperationInputParameters {
    return {
        path: [],
        query: [],
        header: [],
        body: []
    };
}

function generateSchemaType(schema: OpenApiSchema | boolean, context: SchemaTypeContext) {
    return extendDependenciesAndGetResult(
        generateSchemaTypeAndImports({
            schema,
            sourceImportPath: context.operationImportPath,
            getModelData: context.getModelData,
            getBinaryType: context.getBinaryType
        }),
        context.dependencyImports
    );
}

function isOperationParameterFromArgument(
    value: OpenApiParameterFromArgument | OpenApiParameterValue
): value is OpenApiParameterFromArgument {
    return 'argumentName' in value;
}

function renderParameter(parameter: OpenApiParameterFromArgument | OpenApiParameterValue) {
    const {paramName} = parameter;
    const propertyName = objectPropertyKey(paramName);
    if (isOperationParameterFromArgument(parameter)) {
        const {destructuringName} = parameter;
        return objectProperty(propertyName, identifier(destructuringName), false, paramName === destructuringName);
    } else {
        const {value} = parameter;
        return objectProperty(propertyName, value, false, false);
    }
}

function generateDestructuringName(paramName: string, postfixes: string[], usedInputNames: Record<string, true>) {
    let destructuringName = paramName;
    if (!isValidIdentifier(destructuringName, true)) {
        destructuringName = generateUniqueName(destructuringName, postfixes, usedInputNames);
        usedInputNames[destructuringName] = true;
    }
    return destructuringName;
}

function getParameterErrorLocation(param: OpenApiParameter, path: string, httpMethod: string) {
    return (
        `${JSON.stringify(param.name)} at path ` +
        `${JSON.stringify(path)}, method ${httpMethod.toUpperCase()}: unsupported style :` +
        JSON.stringify(param.style)
    );
}

function createIncompatibleParameterStyleError(param: OpenApiParameter, path: string, httpMethod: string) {
    return new Error(`Could not process parameter ${getParameterErrorLocation(param, path, httpMethod)}`);
}

function validateOperationParameter(
    parameter: OpenApiParameter,
    path: string,
    httpMethod: string
): asserts parameter is OpenApiParameter & {in: Exclude<OpenApiParameter['in'], 'cookie'>} {
    if (parameter.in === 'path') {
        if (parameter.style && parameter.style !== 'simple') {
            throw createIncompatibleParameterStyleError(parameter, path, httpMethod);
        }
        if (!parameter.required) {
            throw new Error(`Path parameters should be required: ${getParameterErrorLocation(parameter, path, httpMethod)}`);
        }
        return;
    }
    if (parameter.in === 'query') {
        if (parameter.style && parameter.style !== 'form') {
            throw createIncompatibleParameterStyleError(parameter, path, httpMethod);
        }
        return;
    }
    if (parameter.in === 'header') {
        if (parameter.style && parameter.style !== 'simple') {
            throw createIncompatibleParameterStyleError(parameter, path, httpMethod);
        }
        return;
    }
    if (parameter.in === 'cookie') {
        throw new Error(`Parameters in cookies are not supported: ${getParameterErrorLocation(parameter, path, httpMethod)}`);
    }
    throw new Error(`Unknown parameter type ${parameter.in}: ${getParameterErrorLocation(parameter, path, httpMethod)}`);
}

function addOperationParameterInput({
    inputParameters,
    parameter,
    operation,
    pathItem,
    path,
    serviceName,
    httpMethod,
    operationName,
    usedInputNames,
    getModelData,
    operationImportPath,
    getBinaryType,
    dependencyImports,
    jsDocRenderConfig,
    generateOperationParameterArgumentName,
    generateOperationParameterJsDoc
}: {
    inputParameters: OperationInputParameters;
    parameter: OpenApiParameter;
    usedInputNames: Record<string, true>;
    generateOperationParameterArgumentName?: GenerateOperationParameterArgumentName;
    generateOperationParameterJsDoc?: GenerateOperationParameterJsDoc;
} & OperationMethodSchemaContext) {
    validateOperationParameter(parameter, path, httpMethod);

    const schema = parameter.schema ?? true;
    if (typeof schema !== 'boolean' && schema.const !== undefined) {
        inputParameters[parameter.in].push({
            paramName: parameter.name,
            value: valueToAstExpression(schema.const)
        });
        return;
    }

    const suggestedParameterName = generateUniqueName(
        parameter.name,
        [parameter.in, `${parameter.in} param`],
        usedInputNames
    );
    const parameterName = generateUniqueName(
        generateOperationParameterArgumentName
            ? generateOperationParameterArgumentName({
                  operation,
                  path,
                  serviceName,
                  parameter,
                  pathItem,
                  operationName,
                  suggestedName: suggestedParameterName,
                  httpMethod
              })
            : suggestedParameterName,
        [],
        usedInputNames
    );
    usedInputNames[parameterName] = true;
    const paramJsDoc = extractJsDoc(parameter);
    inputParameters[parameter.in].push({
        paramName: parameter.name,
        argumentName: parameterName,
        destructuringName: generateDestructuringName(
            parameterName,
            [parameter.in, `${parameter.in} param`],
            usedInputNames
        ),
        optional: !parameter.required,
        type: generateSchemaType(schema, {getModelData, operationImportPath, getBinaryType, dependencyImports}),
        docs: renderJsDoc(
            generateOperationParameterJsDoc
                ? generateOperationParameterJsDoc({
                      suggestedJsDoc: paramJsDoc,
                      operation,
                      operationName,
                      serviceName,
                      parameter,
                      pathItem,
                      path,
                      httpMethod
                  })
                : paramJsDoc,
            jsDocRenderConfig
        )
    });
}

function getRequestBodyMediaTypes(requestBody: OpenApiRequestBody) {
    const mediaTypes = Object.entries(requestBody.content).sort(([a], [b]) => a.localeCompare(b));
    if (mediaTypes.length > 1) {
        for (let i = 0; i < mediaTypes.length; i++) {
            if (isWildcardMediaType(mediaTypes[i][0])) {
                mediaTypes.splice(i, 1);
            }
        }
    }
    return mediaTypes;
}

function addMultiMediaTypeRequestBodyInputs({
    inputParameters,
    mediaTypesWithRequestBodyNames,
    allRequestBodyNames,
    mediaTypeName,
    requestBody,
    operation,
    pathItem,
    path,
    serviceName,
    httpMethod,
    operationName,
    usedInputNames,
    getModelData,
    operationImportPath,
    getBinaryType,
    dependencyImports,
    jsDocRenderConfig,
    generateOperationRequestBodyJsDoc
}: {
    inputParameters: OperationInputParameters;
    mediaTypesWithRequestBodyNames: {mediaType: string; content: OpenApiMediaType; requestBodyName: string}[];
    allRequestBodyNames: string[];
    mediaTypeName: string;
    requestBody: OpenApiRequestBody;
    usedInputNames: Record<string, true>;
    generateOperationRequestBodyJsDoc?: GenerateOperationRequestBodyJsDoc;
} & OperationMethodSchemaContext) {
    const additionUnion = tsUnionType([]);
    let defaultMediaType: string | undefined;
    for (const {mediaType, content, requestBodyName} of mediaTypesWithRequestBodyNames) {
        const schema = content.schema ?? true;
        let isDefaultType = false;
        if (!defaultMediaType && isJsonMediaType(mediaType)) {
            isDefaultType = true;
            defaultMediaType = mediaType;
        }
        const mediaTypeArgumentType = isWildcardMediaType(mediaType)
            ? tsStringKeyword()
            : tsLiteralType(stringLiteral(mediaType));
        const mediaTypePropertySignature = tsPropertySignature(
            identifier(mediaTypeName),
            tsTypeAnnotation(mediaTypeArgumentType),
            isDefaultType
        );
        const jsdoc = extractJsDoc({...requestBody, ...content});
        additionUnion.types.push(
            tsTypeLiteral([
                mediaTypePropertySignature,
                ...allRequestBodyNames.map((requestBodyNameItem) => {
                    const isCurrentRequestBody = requestBodyNameItem === requestBodyName;
                    const property = attachJsDocComment(
                        tsPropertySignature(
                            identifier(requestBodyName),
                            tsTypeAnnotation(
                                isCurrentRequestBody
                                    ? generateSchemaType(schema, {
                                          getModelData,
                                          operationImportPath,
                                          getBinaryType,
                                          dependencyImports
                                      })
                                    : tsUndefinedKeyword()
                            )
                        ),
                        renderJsDoc(
                            generateOperationRequestBodyJsDoc
                                ? generateOperationRequestBodyJsDoc({
                                      suggestedJsDoc: jsdoc,
                                      serviceName,
                                      operation,
                                      pathItem,
                                      operationName,
                                      content,
                                      requestBody,
                                      path,
                                      mediaType,
                                      httpMethod
                                  })
                                : jsdoc,
                            jsDocRenderConfig
                        )
                    );
                    return tsPropertySignature(property.name, tsTypeAnnotation(property.type!), !isCurrentRequestBody);
                })
            ])
        );
    }
    inputParameters['header'].push({
        paramName: 'Content-Type',
        argumentName: mediaTypeName,
        destructuringName: generateDestructuringName(mediaTypeName, [], usedInputNames),
        docs: null,
        defaultValue: defaultMediaType ? stringLiteral(defaultMediaType) : undefined
    });
    for (const requestBodyName of allRequestBodyNames) {
        inputParameters['body'].push({
            argumentName: requestBodyName,
            destructuringName: generateDestructuringName(requestBodyName, [], usedInputNames),
            paramName: requestBodyName,
            docs: null
        });
    }
    return additionUnion;
}

function addSingleMediaTypeRequestBodyInputs({
    inputParameters,
    mediaType,
    content,
    requestBodyName,
    mediaTypeName,
    requestBody,
    operation,
    pathItem,
    path,
    serviceName,
    httpMethod,
    operationName,
    usedInputNames,
    getModelData,
    operationImportPath,
    getBinaryType,
    dependencyImports,
    jsDocRenderConfig,
    generateOperationRequestBodyJsDoc
}: {
    inputParameters: OperationInputParameters;
    mediaType: string;
    content: OpenApiMediaType;
    requestBodyName: string;
    mediaTypeName: string;
    requestBody: OpenApiRequestBody;
    usedInputNames: Record<string, true>;
    generateOperationRequestBodyJsDoc?: GenerateOperationRequestBodyJsDoc;
} & OperationMethodSchemaContext) {
    const schema = content.schema ?? true;
    const jsdoc = extractJsDoc({...requestBody, ...content});
    if (mediaType.includes('*')) {
        inputParameters['header'].push({
            paramName: 'Content-Type',
            argumentName: mediaTypeName,
            destructuringName: generateDestructuringName(mediaTypeName, [], usedInputNames),
            docs: null,
            type: tsStringKeyword()
        });
    } else {
        inputParameters['header'].push({
            paramName: 'Content-Type',
            value: stringLiteral(mediaType)
        });
    }
    inputParameters['body'].push({
        paramName: requestBodyName,
        argumentName: requestBodyName,
        destructuringName: generateDestructuringName(requestBodyName, [], usedInputNames),
        type: generateSchemaType(schema, {getModelData, operationImportPath, getBinaryType, dependencyImports}),
        docs: renderJsDoc(
            generateOperationRequestBodyJsDoc
                ? generateOperationRequestBodyJsDoc({
                      suggestedJsDoc: jsdoc,
                      serviceName,
                      operation,
                      pathItem,
                      operationName,
                      content,
                      requestBody,
                      path,
                      mediaType,
                      httpMethod
                  })
                : jsdoc,
            jsDocRenderConfig
        )
    });
}

function addRequestBodyInputs({
    inputParameters,
    requestBody,
    operation,
    pathItem,
    path,
    serviceName,
    httpMethod,
    operationName,
    usedInputNames,
    getModelData,
    operationImportPath,
    getBinaryType,
    dependencyImports,
    jsDocRenderConfig,
    generateOperationRequestBodyArgumentName,
    mediaTypeArgumentName,
    generateOperationRequestBodyJsDoc
}: {
    inputParameters: OperationInputParameters;
    requestBody: OpenApiRequestBody;
    usedInputNames: Record<string, true>;
    generateOperationRequestBodyArgumentName?: GenerateOperationRequestBodyArgumentName;
    mediaTypeArgumentName?: MediaTypeArgumentName;
    generateOperationRequestBodyJsDoc?: GenerateOperationRequestBodyJsDoc;
} & OperationMethodSchemaContext): {requestBodyArgumentNames: string[]; argumentExtensionType?: TSType} {
    inputParameters['body'] = [];
    const mediaTypes = getRequestBodyMediaTypes(requestBody);
    const mediaTypeName = generateUniqueName(mediaTypeArgumentName ?? 'mediaType', [], usedInputNames);
    usedInputNames[mediaTypeName] = true;
    const mediaTypesWithRequestBodyNames = mediaTypes.map(([mediaType, content]) => {
        const requestBodySuggestedName = generateUniqueName(
            getUserFreiendlySchemaName(content.schema ?? true) ?? 'request body',
            [],
            usedInputNames
        );
        return {
            mediaType,
            content,
            requestBodyName: generateUniqueName(
                generateOperationRequestBodyArgumentName
                    ? generateOperationRequestBodyArgumentName({
                          path,
                          pathItem,
                          operation,
                          operationName,
                          serviceName,
                          content,
                          requestBody,
                          mediaType,
                          suggestedName: requestBodySuggestedName,
                          httpMethod
                      })
                    : requestBodySuggestedName,
                [],
                usedInputNames
            )
        };
    });
    const requestBodyArgumentNames = uniq(
        mediaTypesWithRequestBodyNames.map(({requestBodyName}) => requestBodyName)
    ).sort((a, b) => a.localeCompare(b));

    if (mediaTypesWithRequestBodyNames.length > 1) {
        return {
            requestBodyArgumentNames,
            argumentExtensionType: addMultiMediaTypeRequestBodyInputs({
                inputParameters,
                mediaTypesWithRequestBodyNames,
                allRequestBodyNames: requestBodyArgumentNames,
                mediaTypeName,
                requestBody,
                operation,
                pathItem,
                path,
                serviceName,
                httpMethod,
                operationName,
                usedInputNames,
                getModelData,
                operationImportPath,
                getBinaryType,
                dependencyImports,
                jsDocRenderConfig,
                generateOperationRequestBodyJsDoc
            })
        };
    }
    if (mediaTypesWithRequestBodyNames.length === 1) {
        const [{mediaType, content, requestBodyName}] = mediaTypesWithRequestBodyNames;
        addSingleMediaTypeRequestBodyInputs({
            inputParameters,
            mediaType,
            content,
            requestBodyName,
            mediaTypeName,
            requestBody,
            operation,
            pathItem,
            path,
            serviceName,
            httpMethod,
            operationName,
            usedInputNames,
            getModelData,
            operationImportPath,
            getBinaryType,
            dependencyImports,
            jsDocRenderConfig,
            generateOperationRequestBodyJsDoc
        });
    }
    return {requestBodyArgumentNames};
}

export function generateOperationMethods({
    paths,
    serviceName,
    getModelData,
    commonHttpClientImportName,
    operationsConfig: {
        generateOperationName,
        generateOperationJsDoc,
        generateOperationResultDescription,
        generateOperationParameterArgumentName,
        generateOperationRequestBodyArgumentName,
        mediaTypeArgumentName,
        generateOperationParameterJsDoc,
        generateOperationRequestBodyJsDoc,
        responseBinaryType = 'blob'
    } = {},
    operationImportPath,
    binaryTypes,
    jsDocRenderConfig
}: {
    paths: OpenApiPaths;
    serviceName?: string;
    getModelData: GetModelData;
    commonHttpClientImportName: string;
    operationsConfig?: OpenApiClientGeneratorConfig['operations'];
    operationImportPath: string;
    binaryTypes: OpenApiClientCustomizableBinaryType[];
    jsDocRenderConfig: JsDocRenderConfig;
}) {
    const dependencyImports: DependencyImports = {};
    const getBinaryType = () =>
        extendDependenciesAndGetResult(generateBinaryType(binaryTypes, operationImportPath), dependencyImports);

    const methodProperties: ClassProperty[] = [];
    const deprecatedOperations: {[methodAndPath: string]: string} = {};

    for (const [path, pathItem] of Object.entries(paths)) {
        for (const httpMethod of openApiHttpMethods) {
            const operation = pathItem[httpMethod];
            if (!operation) {
                continue;
            }
            const suggestedOperationMethodName = applyEntityNameCase(
                operation.operationId ?? `${httpMethod}:${path}`,
                'camelCase'
            );
            const operationName = generateOperationName
                ? generateOperationName({
                      suggestedName: suggestedOperationMethodName,
                      operation,
                      pathItem,
                      path,
                      serviceName,
                      httpMethod
                  })
                : suggestedOperationMethodName;
            if (operation.deprecated) {
                deprecatedOperations[`${httpMethod.toUpperCase()} ${path}`] = operationName;
            }
            const operationReturn = getOperationReturnType({
                operation,
                getModelData,
                operationImportPath,
                commonHttpClientImportName,
                binaryType: responseBinaryType
            });
            const parameters = sortParameters(operation.parameters ?? []);
            const usedInputNames: Record<string, true> = {};
            const inputParameters = createOperationInputParameters();
            for (const parameter of parameters) {
                addOperationParameterInput({
                    inputParameters,
                    parameter,
                    operation,
                    pathItem,
                    path,
                    serviceName,
                    httpMethod,
                    operationName,
                    usedInputNames,
                    getModelData,
                    operationImportPath,
                    getBinaryType,
                    dependencyImports,
                    jsDocRenderConfig,
                    generateOperationParameterArgumentName,
                    generateOperationParameterJsDoc
                });
            }
            let jsdoc = extractJsDoc(operation);
            if (operationReturn.suggestedDescription || generateOperationResultDescription) {
                jsdoc.tags.push({
                    name: 'returns',
                    value: generateOperationResultDescription
                        ? generateOperationResultDescription({
                              serviceName,
                              suggestedDescription: operationReturn.suggestedDescription,
                              operation,
                              pathItem,
                              path,
                              httpMethod
                          })
                        : operationReturn.suggestedDescription
                });
            }
            if (generateOperationJsDoc) {
                jsdoc = generateOperationJsDoc({
                    suggestedJsDoc: jsdoc,
                    serviceName,
                    httpMethod,
                    pathItem,
                    path,
                    operation
                });
            }

            const requestObject = objectExpression([
                objectProperty(identifier('path'), stringLiteral(path)),
                objectProperty(identifier('method'), stringLiteral(httpMethod.toUpperCase()))
            ]);

            let requestBodyArgumentNames: string[] | undefined;
            let argumentExtensionType: TSType | undefined;
            const requestBody = operation.requestBody;
            if (requestBody) {
                const requestBodyInputs = addRequestBodyInputs({
                    inputParameters,
                    requestBody,
                    operation,
                    pathItem,
                    path,
                    serviceName,
                    httpMethod,
                    operationName,
                    usedInputNames,
                    getModelData,
                    operationImportPath,
                    getBinaryType,
                    dependencyImports,
                    jsDocRenderConfig,
                    generateOperationRequestBodyArgumentName,
                    mediaTypeArgumentName,
                    generateOperationRequestBodyJsDoc
                });
                requestBodyArgumentNames = requestBodyInputs.requestBodyArgumentNames;
                argumentExtensionType = requestBodyInputs.argumentExtensionType;
            }

            if (inputParameters['path'].length > 0) {
                requestObject.properties.push(
                    objectProperty(
                        identifier('pathParams'),
                        objectExpression(inputParameters['path'].map(renderParameter))
                    )
                );
            }

            if (inputParameters['query'].length > 0) {
                requestObject.properties.push(
                    objectProperty(identifier('query'), objectExpression(inputParameters['query'].map(renderParameter)))
                );
            }

            if (inputParameters['header'].length > 0) {
                requestObject.properties.push(
                    objectProperty(
                        identifier('headers'),
                        objectExpression(inputParameters['header'].map(renderParameter))
                    )
                );
            }

            const parametersSerializationInfo = buildParametersSerializationInfo(parameters);
            if (parametersSerializationInfo) {
                requestObject.properties.push(objectProperty(identifier('parameters'), parametersSerializationInfo));
            }

            const argument = objectPattern([]);
            const argumentType = tsTypeLiteral([]);
            for (const {argumentName, destructuringName, type, optional, docs, defaultValue} of Object.values(
                inputParameters
            )
                .flatMap((params) => params)
                .filter(isOperationParameterFromArgument)) {
                argument.properties.push(
                    objectPatternProperty(
                        identifier(argumentName),
                        defaultValue
                            ? assignmentPattern(identifier(destructuringName), defaultValue)
                            : identifier(destructuringName),
                        false,
                        argumentName === destructuringName
                    )
                );
                if (type) {
                    const propertySignature = attachJsDocComment(
                        tsPropertySignature(identifier(argumentName), tsTypeAnnotation(type)),
                        docs
                    );
                    argumentType.members.push(tsPropertySignature(propertySignature.name, tsTypeAnnotation(propertySignature.type!), optional));
                }
            }
            argument.typeAnnotation = tsTypeAnnotation(
                argumentExtensionType ? mergeTypes(argumentType, argumentExtensionType) : argumentType
            );

            if (requestBodyArgumentNames && requestBodyArgumentNames.length > 0) {
                requestObject.properties.push(
                    objectProperty(
                        identifier('body'),
                        requestBodyArgumentNames.length > 1
                            ? callExpression(
                                  memberExpression(identifier('commonHttpClient'), identifier('pickRequestBody')),
                                  requestBodyArgumentNames.map(identifier)
                              )
                            : identifier(requestBodyArgumentNames[0])
                    )
                );
            }

            const operationMethod = (
                argument.properties.length > 0
                    ? arrowFunctionExpression(
                          argument,
                          blockStatement([
                              returnStatement(
                                  operationReturn.wrapResultExpression(
                                      callExpression(
                                          memberExpression(
                                              callExpression(
                                                  memberExpression(thisExpression(), identifier('getClientInstance')),
                                                  []
                                              ),
                                              identifier('request')
                                          ),
                                          [requestObject]
                                      )
                                  )
                              )
                          ]),
                          argument.properties.length > 0 && isAssignableToEmptyObject(argument.typeAnnotation!)
                              ? objectExpression([])
                              : undefined,
                          true
                      )
                    : arrowFunctionExpression(
                          [] as readonly ts.ParameterDeclaration[],
                          blockStatement([
                              returnStatement(
                                  operationReturn.wrapResultExpression(
                                      callExpression(
                                          memberExpression(
                                              callExpression(
                                                  memberExpression(thisExpression(), identifier('getClientInstance')),
                                                  []
                                              ),
                                              identifier('request')
                                          ),
                                          [requestObject]
                                      )
                                  )
                              )
                          ]),
                          undefined,
                          true
                      )
            );
            const operationMethodProperty = classProperty(
                identifier(operationName),
                setArrowFunctionReturnType(
                    operationMethod,
                    tsTypeReference(identifier('Promise'), tsTypeParameterInstantiation([operationReturn.type]))
                )
            );
            extendDependencyImports(dependencyImports, operationReturn.dependencyImports);
            methodProperties.push(attachJsDocComment(operationMethodProperty, renderJsDoc(jsdoc, jsDocRenderConfig)));
        }
    }
    methodProperties.sort((a, b) => (a.name as Identifier).text.localeCompare((b.name as Identifier).text));

    return {methods: methodProperties, dependencyImports, deprecatedOperations};
}
