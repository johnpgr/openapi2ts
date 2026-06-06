import * as commonHttpClient from "./core/common-http-client";
import { CommonHttpService as CommonHttpService } from "./core/common-http-service";
import { PetService as PetService } from "./services/pet-service";
import { StoreService as StoreService } from "./services/store-service";
import { UserService as UserService } from "./services/user-service";
export type PetStoreApiClientOptions = Partial<commonHttpClient.CommonHttpClientOptions>;
/** Error class for undefined */
export class PetStoreApiClientError extends commonHttpClient.CommonHttpClientError {
    name = "PetStoreApiClientError";
}
/**
 * Swagger Petstore
 *
 * This is a sample server Petstore server.  You can find out more about Swagger
 * at [http://swagger.io](http://swagger.io) or on [irc.freenode.net,
 * #swagger](http://swagger.io/irc/).  For this sample, you can use the api key
 * `special-key` to test the authorization filters.
 *
 * @version 1.0.0
 */
export class PetStoreApiClient extends CommonHttpService {
    protected client = new commonHttpClient.CommonHttpClient({ apiClientClassName: this.constructor.name ?? "name", baseUrl: "https://petstore.swagger.io/v2", binaryResponseType: "blob", errorClass: PetStoreApiClientError, deprecatedOperations: { "GET /pet/findByTags": "pet.findPetsByTags" } });
    protected getClient = () => this.client;
    /** Everything about your Pets */
    get pet() {
        return this.getServiceInstance(PetService);
    }
    /** Access to Petstore orders */
    get store() {
        return this.getServiceInstance(StoreService);
    }
    /** Operations about user */
    get user() {
        return this.getServiceInstance(UserService);
    }
    constructor(options?: PetStoreApiClientOptions) {
        super(() => this.client);
        this.client.setOptions({ ...this.client.getOptions(), ...options });
    }
}
