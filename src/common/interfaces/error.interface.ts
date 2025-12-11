export interface PaystackErrorInterface {
  httpStatusCode?: number;
  status?: boolean;
  type: string;
  code: string;
  data?: object;
  message: string;
}
