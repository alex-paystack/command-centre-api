import { PaystackErrorInterface } from '../interfaces/error.interface';

export class PaystackError extends Error implements PaystackErrorInterface {
  public httpStatusCode: number;
  public status: boolean;
  public type: string;
  public code: string;
  public data: object | undefined;
  public message: string;

  constructor(error: PaystackErrorInterface) {
    super(error.code);
    this.httpStatusCode = error.httpStatusCode ?? 500;
    this.status = !!error.status;
    this.type = error.type;
    this.code = error.code;
    this.message = error.message;
    this.data = error.data;
  }

  toPlainObject(): PaystackErrorInterface {
    return {
      status: false,
      code: this.code,
      type: this.type,
      data: this.data,
      message: this.message,
    };
  }
}
