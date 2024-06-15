import { Header } from "@/components/header";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-full max-w-screen-2xl mx-auto">
      <Header />
      <main className="px-4 m-4 lg:px-14">{children}</main>
    </div>
  );
};

export default Layout;
