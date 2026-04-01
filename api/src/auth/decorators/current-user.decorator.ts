import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUserShape = { sub: string; email: string };

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUserShape | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUserShape }>();
    const user = req.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
