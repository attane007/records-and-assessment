export type AdminSession = {
  sub: string;
  username: string;
  exp: number;
};

export type ApiErrorResponse = {
  error: string;
};

export type MeResponse =
  | {
    authenticated: true;
    session: AdminSession;
  }
  | {
    authenticated: false;
  };

export type LoginRequestBody = {
  username: string;
  password: string;
};

export type ChangePasswordRequestBody = {
  currentPassword: string;
  newPassword: string;
};

export type SubmitRequestBody = {
  name: string;
  prefix: string;
  id_card: string;
  student_id?: string;
  date_of_birth: string;
  purpose: string;
  document_type: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
};

export type SubmitResponse = {
  message: string;
  id: string;
};

export type SignatureMethod = "draw" | "upload";
export type SignedVia = "web" | "mobile" | "qr-mobile";
export type SignRole = "student" | "registrar" | "director";
export type OfficialDecision = "approve" | "reject";

export type SignatureBlock = {
  data_base64: string;
  method: SignatureMethod;
  signed_via: SignedVia;
  signed_at: string;
  document_hash?: string;
};

export type RequestSignatures = {
  student?: SignatureBlock;
  registrar?: SignatureBlock;
  director?: SignatureBlock;
};

export type OfficialDecisionBlock = {
  decision: OfficialDecision;
  decided_at: string;
  document_hash?: string;
};

export type RequestDecisions = {
  registrar?: OfficialDecisionBlock;
  director?: OfficialDecisionBlock;
};

export type UpdateSignatureRequestBody = {
  data_base64: string;
  method: SignatureMethod;
  signed_via?: SignedVia;
  decision?: OfficialDecision;
};

export type CreateSignLinkRequestBody = {
  role: Extract<SignRole, "registrar" | "director">;
  channel: "email" | "copy";
  recipient_email?: string;
};

export type CreateSignLinkResponse = {
  message: string;
  sign_url: string;
  token: string;
  role: Extract<SignRole, "registrar" | "director">;
  channel: "email" | "copy";
  recipient_email?: string;
  expires_at: string;
  email_sent: boolean;
  warning?: string;
};

export type SignLinkInfoResponse = {
  role: Extract<SignRole, "registrar" | "director">;
  request_id: string;
  expires_at: string;
  used_at?: string;
  revoked: boolean;
  active: boolean;
  status_message?: string;
  request: {
    id: string;
    prefix: string;
    name: string;
    document_type: string;
    purpose: string;
  };
};

export type CreateSignSessionRequestBody =
  | {
    request_id: string;
    role: "student";
    token?: never;
    decision?: never;
  }
  | {
    token: string;
    request_id?: never;
    role?: never;
    decision?: OfficialDecision;
  };

export type CreateSignSessionResponse = {
  session_id: string;
  status: "pending" | "completed" | "expired";
  expires_at: string;
  mobile_url: string;
  request_id: string;
  role: SignRole;
};

export type SignSessionStatusResponse = {
  session_id: string;
  status: "pending" | "completed" | "expired";
  expires_at: string;
  completed_at?: string;
  request_id: string;
  role: SignRole;
};

export type ValidationErrorResponse = {
  errors: Partial<Record<string, string>>;
};

export type OfficialsPayload = {
  registrar_name: string;
  director_name: string;
  registrar_email?: string;
  director_email?: string;
};

export type RequestStatus = "pending" | "completed" | "cancelled";

export type RequestRecord = {
  id: string;
  prefix: string;
  name: string;
  document_type: string;
  id_card: string;
  student_id?: string;
  date_of_birth: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
  purpose: string;
  status: RequestStatus | string;
  signatures?: RequestSignatures;
  decisions?: RequestDecisions;
  created_at: string;
};

export type RequestsResponse = {
  requests: RequestRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
