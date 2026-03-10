import SignLinkClient from "./SignLinkClient";

export default async function SignTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SignLinkClient token={token} />;
}
