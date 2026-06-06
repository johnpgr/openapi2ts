import * as commonHttpClient from "../core/common-http-client";
import { CommonHttpService as CommonHttpService } from "../core/common-http-service";
import type { Pet as Pet, ApiResponse as ApiResponse } from "../models/pet";
/** Everything about your Pets */
export class PetService extends CommonHttpService {
    addPet = async ({ mediaType = "application/json", pet }: {} & ({
        mediaType?: "application/json";
        pet: Pet;
    } | {
        mediaType: "application/xml";
        pet: Pet;
    })): Promise<void> => {
        return this.getClientInstance().request({ path: "/pet", method: "POST", headers: { "Content-Type": mediaType }, body: pet }).then(commonHttpClient.discardResult);
    };
    deletePet = async ({ petId, apiKey }: {
        petId: number;
        apiKey?: string;
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/pet/{petId}", method: "DELETE", pathParams: { petId }, headers: { api_key: apiKey } }).then(commonHttpClient.discardResult);
    };
    /**
     * Multiple status values can be provided with comma separated strings
     *
     * @returns
     *  * status: 200, mediaType: application/xml
     *
     *    successful operation
     *
     *  * status: 200, mediaType: application/json
     *
     *    successful operation
     */
    findPetsByStatus = async ({ status }: {
        status: ("available" | "pending" | "sold")[];
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: Pet[];
    }>> => {
        return this.getClientInstance().request({ path: "/pet/findByStatus", method: "GET", query: { status } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: Pet[];
        }>());
    };
    /**
     * Muliple tags can be provided with comma separated strings. Use tag1, tag2, tag3
     * for testing.
     *
     * @deprecated
     * @returns
     *  * status: 200, mediaType: application/xml
     *
     *    successful operation
     *
     *  * status: 200, mediaType: application/json
     *
     *    successful operation
     */
    findPetsByTags = async ({ tags }: {
        tags: string[];
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: Pet[];
    }>> => {
        return this.getClientInstance().request({ path: "/pet/findByTags", method: "GET", query: { tags } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: Pet[];
        }>());
    };
    /**
     * Returns a single pet
     *
     * @returns
     *  * status: 200, mediaType: application/xml
     *
     *    successful operation
     *
     *  * status: 200, mediaType: application/json
     *
     *    successful operation
     */
    getPetById = async ({ petId }: {
        petId: number;
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: Pet;
    }>> => {
        return this.getClientInstance().request({ path: "/pet/{petId}", method: "GET", pathParams: { petId } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: Pet;
        }>());
    };
    updatePet = async ({ mediaType = "application/json", pet }: {} & ({
        mediaType?: "application/json";
        pet: Pet;
    } | {
        mediaType: "application/xml";
        pet: Pet;
    })): Promise<void> => {
        return this.getClientInstance().request({ path: "/pet", method: "PUT", headers: { "Content-Type": mediaType }, body: pet }).then(commonHttpClient.discardResult);
    };
    updatePetWithForm = async ({ petId, requestBody }: {
        petId: number;
        requestBody: {
            /** Updated name of the pet */
            name?: string;
            /** Updated status of the pet */
            status?: string;
        } & {
            [key: string]: unknown;
        };
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/pet/{petId}", method: "POST", pathParams: { petId }, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: requestBody }).then(commonHttpClient.discardResult);
    };
    /** @returns successful operation */
    uploadFile = async ({ petId, requestBody }: {
        petId: number;
        requestBody: Blob | ReadableStream;
    }): Promise<ApiResponse> => {
        return this.getClientInstance().request({ path: "/pet/{petId}/uploadImage", method: "POST", pathParams: { petId }, headers: { "Content-Type": "application/octet-stream" }, body: requestBody }).then(this.getClientInstance().responseHandler({ 200: { "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/json";
            body: ApiResponse;
        }>()).then(commonHttpClient.getBody);
    };
}
