import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import { Button } from "./ui/button";

type Props = {
  label: string;
  href: string;
  isActive?: boolean;
};

export const NavButton = ({ href, label, isActive }: Props) => {
  return (
    <Button asChild variant="outline" size="sm">
      <NavLink
        to={href}
        className={cn(
          "w-full lg:w-auto justify-between font-normal hover:bg-white/20 hover:text-white border-none focus-visible:ring-offset-0 focus-visible:ring-transparent outline-none text-white focus:bg-white/30 transition",
          isActive ? "bg-white/10 text-white" : "bg-transparent"
        )}
      >
        {label}
      </NavLink>
    </Button>
  );
};
