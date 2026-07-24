import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/produtos/novo")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/produtos/$id", params: { id: "novo" } }); },
  component: () => null,
});
