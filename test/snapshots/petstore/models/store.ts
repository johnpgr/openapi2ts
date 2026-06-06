export interface Order extends Record<string, unknown> {
    id?: number;
    petId?: number;
    quantity?: number;
    shipDate?: string;
    /** Order Status */
    status?: "placed" | "approved" | "delivered";
    complete?: boolean;
}
