declare module "express" {
  interface Request {
    body?: any;
    params: Record<string, string>;
  }

  interface Response {
    status(code: number): Response;
    json(payload: any): Response;
  }

  interface ExpressApp {
    use(...args: any[]): void;
    get(
      path: string,
      handler: (req: Request, res: Response) => void,
    ): void;
    post(
      path: string,
      handler: (
        req: Request,
        res: Response,
      ) => void | Promise<void>,
    ): void;
    listen(
      port: number,
      callback: () => void,
    ): void;
  }

  interface Express {
    (): ExpressApp;
    json(): any;
  }

  const express: Express;

  export default express;
  export type { Request, Response };
}
