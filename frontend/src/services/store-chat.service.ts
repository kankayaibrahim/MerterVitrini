import {
  ChatMessage,
  ChatRoom,
  SupplierAgent,
  getOrInitCustomerChatIdentity,
} from "@/types/chat";
import {
  CustomerChatHeaderStrategy,
  FetchHttpClient,
  IHttpClient,
} from "./http-client";

export interface InitChatRoomParams {
  readonly brandId?: string;
  readonly supplierUserId?: string;
  readonly productId?: string;
}

export interface IStoreChatService {
  listBrandAgents(brandId: string): Promise<SupplierAgent[]>;
  listCustomerRooms(): Promise<ChatRoom[]>;
  initOrGetRoom(params: InitChatRoomParams): Promise<ChatRoom | null>;
  listRoomMessages(roomId: string): Promise<ChatMessage[]>;
  sendCustomerMessage(
    roomId: string,
    content: string,
    displayNameOverride?: string
  ): Promise<ChatMessage | null>;
  acceptCustomOffer(messageId: string): Promise<boolean>;
  saveGuestDisplayName(name: string): void;
}

export class HttpStoreChatService implements IStoreChatService {
  constructor(
    private readonly http: IHttpClient = new FetchHttpClient({
      authStrategy: new CustomerChatHeaderStrategy(),
    })
  ) {}

  async listBrandAgents(brandId: string): Promise<SupplierAgent[]> {
    if (!brandId) return [];
    const res = await this.http.rawFetch(
      `/api/v1/store/chat/brands/${encodeURIComponent(brandId)}/agents`
    );
    if (!res.ok) return [];
    const list = (await res.json()) as SupplierAgent[] | null;
    return Array.isArray(list) ? list : [];
  }

  async listCustomerRooms(): Promise<ChatRoom[]> {
    const identity = getOrInitCustomerChatIdentity();
    const res = await this.http.rawFetch(
      `/api/v1/store/chat/rooms?customer_id=${encodeURIComponent(identity.customerId)}`
    );
    if (!res.ok) return [];
    const list = (await res.json()) as ChatRoom[] | null;
    return Array.isArray(list) ? list : [];
  }

  async initOrGetRoom(params: InitChatRoomParams): Promise<ChatRoom | null> {
    const identity = getOrInitCustomerChatIdentity();
    const res = await this.http.rawFetch("/api/v1/store/chat/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_id: params.brandId ?? "",
        supplier_user_id: params.supplierUserId ?? "",
        product_id: params.productId ?? "",
        customer_id: identity.customerId,
        customer_name: identity.customerName,
        customer_email: identity.customerEmail,
        customer_phone: identity.customerPhone,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ChatRoom;
  }

  async listRoomMessages(roomId: string): Promise<ChatMessage[]> {
    const res = await this.http.rawFetch(
      `/api/v1/store/chat/rooms/${encodeURIComponent(roomId)}/messages`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ChatMessage[] | null;
    return Array.isArray(data) ? data : [];
  }

  async sendCustomerMessage(
    roomId: string,
    content: string,
    displayNameOverride?: string
  ): Promise<ChatMessage | null> {
    const identity = getOrInitCustomerChatIdentity();
    const res = await this.http.rawFetch(
      `/api/v1/store/chat/rooms/${encodeURIComponent(roomId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: identity.customerId,
          customer_name: displayNameOverride?.trim() || identity.customerName,
          content,
        }),
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as ChatMessage;
  }

  async acceptCustomOffer(messageId: string): Promise<boolean> {
    const res = await this.http.rawFetch(
      `/api/v1/store/chat/messages/${encodeURIComponent(messageId)}/accept-offer`,
      { method: "POST" }
    );
    return res.ok;
  }

  saveGuestDisplayName(name: string): void {
    const trimmed = name.trim();
    if (trimmed && typeof window !== "undefined") {
      localStorage.setItem("merter_chat_guest_name", trimmed);
    }
  }
}

export const storeChatService: IStoreChatService = new HttpStoreChatService();

