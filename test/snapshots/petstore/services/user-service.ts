import * as commonHttpClient from "../core/common-http-client";
import { CommonHttpService as CommonHttpService } from "../core/common-http-service";
import type { User as User } from "../models/user";
/** Operations about user */
export class UserService extends CommonHttpService {
    /** This can only be done by the logged in user. */
    createUser: Promise<void> = ({ user }: {
        user: User;
    }) => {
        return this.getClientInstance().request({ path: "/user", method: "POST", headers: { "Content-Type": "application/json" }, body: user }).then(commonHttpClient.discardResult);
    };
    createUsersWithArrayInput: Promise<void> = ({ users }: {
        users: User[];
    }) => {
        return this.getClientInstance().request({ path: "/user/createWithArray", method: "POST", headers: { "Content-Type": "application/json" }, body: users }).then(commonHttpClient.discardResult);
    };
    createUsersWithListInput: Promise<void> = ({ users }: {
        users: User[];
    }) => {
        return this.getClientInstance().request({ path: "/user/createWithList", method: "POST", headers: { "Content-Type": "application/json" }, body: users }).then(commonHttpClient.discardResult);
    };
    /** This can only be done by the logged in user. */
    deleteUser: Promise<void> = ({ username }: {
        username: string;
    }) => {
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
    getUserByName: Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: User;
    }>> = ({ username }: {
        username: string;
    }) => {
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
    loginUser: Promise<commonHttpClient.WithResponse<{
        status: 200;
        mediaType: "application/xml";
        body: Blob;
    } | {
        status: 200;
        mediaType: "application/json";
        body: string;
    }>> = ({ username, password }: {
        username: string;
        password: string;
    }) => {
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
    logoutUser: Promise<void> = () => {
        return this.getClientInstance().request({ path: "/user/logout", method: "GET" }).then(commonHttpClient.discardResult);
    };
    /** This can only be done by the logged in user. */
    updateUser: Promise<void> = ({ username, user }: {
        username: string;
        user: User;
    }) => {
        return this.getClientInstance().request({ path: "/user/{username}", method: "PUT", pathParams: { username }, headers: { "Content-Type": "application/json" }, body: user }).then(commonHttpClient.discardResult);
    };
}
