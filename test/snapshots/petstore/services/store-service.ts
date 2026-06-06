import * as commonHttpClient from "../core/common-http-client";
import { CommonHttpService as CommonHttpService } from "../core/common-http-service";
import type { Order as Order } from "../models/store";
/** Access to Petstore orders */
export class StoreService extends CommonHttpService {
    /**
     * For valid response try integer IDs with positive integer value. Negative or
     * non-integer values will generate API errors
     */
    deleteOrder = async ({ orderId }: {
        orderId: number;
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/store/order/{orderId}", method: "DELETE", pathParams: { orderId } }).then(commonHttpClient.discardResult);
    };
    /**
     * Returns a map of status codes to quantities
     *
     * @returns successful operation
     */
    getInventory = async (): Promise<{
        [key: string]: number;
    }> => {
        return this.getClientInstance().request({ path: "/store/inventory", method: "GET" }).then(this.getClientInstance().responseHandler({ 200: { "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/json";
            body: {
                [key: string]: number;
            };
        }>()).then(commonHttpClient.getBody);
    };
    /**
     * For valid response try integer IDs with value >= 1 and <= 10. Other values will
     * generated exceptions
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
    getOrderById = async ({ orderId }: {
        orderId: number;
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: Order;
    }>> => {
        return this.getClientInstance().request({ path: "/store/order/{orderId}", method: "GET", pathParams: { orderId } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: Order;
        }>());
    };
    /**
     * @returns
     *  * status: 200, mediaType: application/xml
     *
     *    successful operation
     *
     *  * status: 200, mediaType: application/json
     *
     *    successful operation
     */
    placeOrder = async ({ order }: {
        order: Order;
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: Order;
    }>> => {
        return this.getClientInstance().request({ path: "/store/order", method: "POST", headers: { "Content-Type": "application/json" }, body: order }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: Order;
        }>());
    };
}
