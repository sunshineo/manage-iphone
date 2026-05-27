export class AppError extends Error {
  constructor(message, { status = 500, code = "APP_ERROR", details } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, {
      status: 400,
      code: "VALIDATION_ERROR",
      details
    });
    this.name = "ValidationError";
  }
}

export class DeviceStateError extends AppError {
  constructor(message, { status = 409, code = "DEVICE_STATE_ERROR", details } = {}) {
    super(message, { status, code, details });
    this.name = "DeviceStateError";
  }
}
