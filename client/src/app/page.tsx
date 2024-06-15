import Layout from "./layout";

const HomePage = () => {
  return (
    <div>
      <Layout>
        <div className="flex flex-col items-center justify-center pt-35">
          <p className="pb-10">SourKimchi</p>
          <div className="object-contain">
            <img src="/kimchi.png" alt="kimchi" />
          </div>
        </div>
      </Layout>
    </div>
  );
};

export default HomePage;
