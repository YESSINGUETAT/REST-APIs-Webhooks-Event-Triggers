export const metadata = {
  title: "Property Management - Payment Integration",
  description: "REST APIs, Webhooks, and Hasura Event Triggers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}