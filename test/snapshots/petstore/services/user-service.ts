import * as commonHttpClient from "../core/common-http-client";
import { CommonHttpService as CommonHttpService } from "../core/common-http-service";
import type { User as User } from "../models/user";
/** Operations about user */
export class UserService extends CommonHttpService {
    /** This can only be done by the logged in user. */
    createUser = async ({ user }: {
        user: User;
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/user", method: "POST", headers: { "Content-Type": "application/json" }, body: user }).then(commonHttpClient.discardResult);
    };
    createUsersWithArrayInput = async ({ users }: {
        users: User[];
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/user/createWithArray", method: "POST", headers: { "Content-Type": "application/json" }, body: users }).then(commonHttpClient.discardResult);
    };
    createUsersWithListInput = async ({ users }: {
        users: User[];
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/user/createWithList", method: "POST", headers: { "Content-Type": "application/json" }, body: users }).then(commonHttpClient.discardResult);
    };
    /** This can only be done by the logged in user. */
    deleteUser = async ({ username }: {
        username: string;
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/user/{username}", method: "DELETE", pathParams: { username } }).then(commonHttpClient.discardResult);
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
    getUserByName = async ({ username }: {
        username: string;
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: User;
    }>> => {
        return this.getClientInstance().request({ path: "/user/{username}", method: "GET", pathParams: { username } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: User;
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
    loginUser = async ({ username, password }: {
        username: string;
        password: string;
    }): Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: string;
    }>> => {
        return this.getClientInstance().request({ path: "/user/login", method: "GET", query: { username, password } }).then(this.getClientInstance().responseHandler({ 200: { "application/xml": "blob", "application/json": "json" } })).then(commonHttpClient.castResponse<{
            status: 200;
            mediaType: "application/xml";
            body: Blob;
        } | {
            status: 200;
            mediaType: "application/json";
            body: string;
        }>());
    };
    logoutUser = async (): Promise<void> => {
        return this.getClientInstance().request({ path: "/user/logout", method: "GET" }).then(commonHttpClient.discardResult);
    };
    /** This can only be done by the logged in user. */
    updateUser = async ({ username, user }: {
        username: string;
        user: User;
    }): Promise<void> => {
        return this.getClientInstance().request({ path: "/user/{username}", method: "PUT", pathParams: { username }, headers: { "Content-Type": "application/json" }, body: user }).then(commonHttpClient.discardResult);
    };
}
