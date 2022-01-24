import { DatabaseOptions } from "pg-boss";

export type DbConfig = {
  enableSslAuth: boolean;
  sslPaths: { ca: string; cert: string; key: string };
} & DatabaseOptions;