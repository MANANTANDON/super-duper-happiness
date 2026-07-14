import "./globals.css";
import Providers from "@/app/providers";

export const metadata = {
  title: "MailChat",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
