import Link from "next/link";
import { getMenu, getTenant, hourLabel, isOpen } from "./lib";
import { Menu } from "./menu";

export default async function Home() {
  const [tenant, menu] = await Promise.all([getTenant(), getMenu()]);
  const open = isOpen(tenant);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1 className="hero-title">
              Delivered in <span className="hero-forty">40</span>
            </h1>
            <p className="hero-sub">
              Flower, concentrates and gear from a licensed shop, brought to your door by a driver who already has it in
              the car. ID checked on delivery.
            </p>
            <div className="row">
              <a className="btn btn-primary" href="#menu">Shop the menu</a>
              <Link className="btn" href="/install">Add to home screen</Link>
            </div>
          </div>
          <dl className="hero-facts">
            <div>
              <dt>Today</dt>
              <dd>{open ? `Open until ${hourLabel(tenant.close_hour)}` : `Opens at ${hourLabel(tenant.open_hour)}`}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>${(tenant.delivery_fee_cents / 100).toFixed(0)} flat</dd>
            </div>
            <div>
              <dt>Minimum</dt>
              <dd>${(tenant.min_order_cents / 100).toFixed(0)}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section id="menu" className="wrap menu-section">
        <Menu items={menu} />
      </section>
    </>
  );
}
