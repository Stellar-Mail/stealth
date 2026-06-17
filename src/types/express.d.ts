declare module "express" {
  export interface Request {
    user?: {
      id: string;
    };
  }

  export interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }

  export interface Router {
    get(path: string, handler: (req: Request, res: Response) => void | Promise<void>): void;
  }

  const express: {
    Router(): Router;
  };

  export default express;
}
