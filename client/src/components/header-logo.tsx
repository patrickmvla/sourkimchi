import { Link } from "react-router-dom";

export const HeaderLogo = () => {
  return (
    <Link to="/">
      <div className="items-center hidden lg:flex">
        <img src="/sklogo.svg" alt="logo" height={28} width={28} />
        <p className="font-semibold text-black text-2xl ml-2.5">SourKimchi</p>
      </div>
    </Link>
  );
};
