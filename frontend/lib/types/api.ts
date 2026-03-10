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

export type ValidationErrorResponse = {
  errors: Partial<Record<string, string>>;
};

export type OfficialsPayload = {
  registrar_name: string;
  director_name: string;
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
  created_at: string;
};

export type RequestsResponse = {
  requests: RequestRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
