import { RouterProvider, createBrowserRouter } from "react-router-dom";
import HomePage from "@/app/dashboard/page";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomePage/>
    }
])

export const Router = () => {
    return <RouterProvider router={router}/>
}