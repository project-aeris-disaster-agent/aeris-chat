export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_AUTH_DISABLED !== undefined
    ? process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true'
    : true;


