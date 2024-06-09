const Layout = ({children}:{children: React.ReactNode}) => {
    return ( 
        <div className="bg-slate-500">
            {children}
        </div>
     );
}
 
export default Layout;