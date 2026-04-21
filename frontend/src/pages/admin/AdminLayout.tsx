import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, Truck } from "lucide-react";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/products", icon: Package, label: "Products" },
  { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/admin/deliveries", icon: Truck, label: "Deliveries" },
  { to: "/admin/customers", icon: Users, label: "Customers" },
  { to: "/admin/reports", icon: BarChart3, label: "Reports" },
];

export default function AdminLayout() {
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-[70vh] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-secondary/20 p-4 space-y-1 hidden md:block">
        <h2 className="font-display text-lg tracking-wider text-foreground px-3 py-2 mb-4">
          Admin Panel
        </h2>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-sm font-body text-sm transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden border-b border-border px-4 py-2 flex gap-2 overflow-x-auto w-full absolute">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-body text-xs whitespace-nowrap ${
                active ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
