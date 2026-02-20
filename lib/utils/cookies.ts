import { cookies } from "next/headers";

export const getCookie = (name: string) => cookies().get(name)?.value ?? null;
