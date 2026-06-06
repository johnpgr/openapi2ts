export interface ApiResponse extends Record<string, unknown> {
    code?: number;
    type?: string;
    message?: string;
}
export interface Category extends Record<string, unknown> {
    id?: number;
    name?: string;
}
export interface Pet extends Record<string, unknown> {
    id?: number;
    category?: Category;
    /**
     * @example
     * doggie
     */
    name: string;
    photoUrls: string[];
    tags?: Tag[];
    /** pet status in the store */
    status?: "available" | "pending" | "sold";
}
export interface Tag extends Record<string, unknown> {
    id?: number;
    name?: string;
}
