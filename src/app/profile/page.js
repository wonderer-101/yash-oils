/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, LogOut, User, Mail, ShoppingBag, MapPin,
  ChevronRight, Clock, CheckCircle, XCircle, Truck, Save, Plus, Pencil, Trash2
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/components/auth/AuthContext";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  fetchCustomerOrders,
  updateCustomerAddress,
  updateCustomerProfile,
} from "@/lib/client/shopifyClient";
import { replaceTo } from "@/lib/client/navigation";
import styles from "./profile.module.css";

const customerAccountUrl = "/api/auth/shopify/account";

function formatMoney(amount, currencyCode = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  let icon = <Clock size={11} />;
  let variant = "pending";
  if (s === "paid" || s === "fulfilled") { icon = <CheckCircle size={11} />; variant = "success"; }
  else if (s === "unfulfilled" || s === "in_progress") { icon = <Truck size={11} />; variant = "info"; }
  else if (s === "refunded" || s === "cancelled") { icon = <XCircle size={11} />; variant = "error"; }
  return (
    <span className={`${styles.badge} ${styles["badge--" + variant]}`}>
      {icon}
      {status?.replace(/_/g, " ") || "Pending"}
    </span>
  );
}

export default function ProfilePage() {
  const { customer, loading, refetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phoneNumber: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMode, setAddressMode] = useState("create");
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressForm, setAddressForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    zoneCode: "",
    zip: "",
    territoryCode: "IN",
    phoneNumber: "",
    defaultAddress: false,
  });

  useEffect(() => {
    if (!loading && !customer) {
      replaceTo("/");
    }
  }, [customer, loading]);

  useEffect(() => {
    if (!customer) return;
    fetchCustomerOrders()
      .then((data) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    setProfileForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      phoneNumber:
        customer.phoneNumber?.phoneNumber ||
        customer.phoneNumber ||
        customer.phone ||
        "",
    });
    setAddressMode("create");
    setEditingAddressId("");
    setAddressForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      company: "",
      address1: "",
      address2: "",
      city: "",
      zoneCode: "",
      zip: "",
      territoryCode: "IN",
      phoneNumber:
        customer.phoneNumber?.phoneNumber ||
        customer.phoneNumber ||
        customer.phone ||
        "",
      defaultAddress: false,
    });
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    loadAddresses();
  }, [customer]);

  async function loadAddresses() {
    setAddressesLoading(true);
    setAddressesError("");
    try {
      const data = await fetchCustomerAddresses();
      setAddresses(data);
    } catch {
      setAddresses([]);
      setAddressesError("Unable to fetch addresses.");
    } finally {
      setAddressesLoading(false);
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileMessage("");
    try {
      await updateCustomerProfile(profileForm);
      await refetch();
      setProfileMessage("Profile updated.");
    } catch {
      setProfileError("Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  function resetAddressForm() {
    setAddressMode("create");
    setEditingAddressId("");
    setAddressForm({
      firstName: profileForm.firstName || "",
      lastName: profileForm.lastName || "",
      company: "",
      address1: "",
      address2: "",
      city: "",
      zoneCode: "",
      zip: "",
      territoryCode: "IN",
      phoneNumber: profileForm.phoneNumber || "",
      defaultAddress: addresses.length === 0,
    });
  }

  function handleEditAddress(address) {
    setAddressMode("edit");
    setEditingAddressId(address.id);
    setAddressForm({
      firstName: address.firstName || "",
      lastName: address.lastName || "",
      company: address.company || "",
      address1: address.address1 || "",
      address2: address.address2 || "",
      city: address.city || "",
      zoneCode: address.zoneCode || "",
      zip: address.zip || "",
      territoryCode: address.territoryCode || "IN",
      phoneNumber: address.phoneNumber || "",
      defaultAddress: Boolean(address.isDefault),
    });
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();
    setAddressSaving(true);
    setAddressesError("");
    try {
      const method = addressMode === "edit" ? "PUT" : "POST";
      const payload = {
        address: {
          firstName: addressForm.firstName,
          lastName: addressForm.lastName,
          company: addressForm.company,
          address1: addressForm.address1,
          address2: addressForm.address2,
          city: addressForm.city,
          zoneCode: addressForm.zoneCode,
          zip: addressForm.zip,
          territoryCode: addressForm.territoryCode,
          phoneNumber: addressForm.phoneNumber,
        },
        defaultAddress: Boolean(addressForm.defaultAddress),
      };
      if (method === "PUT") {
        payload.addressId = editingAddressId;
      }

      if (method === "PUT") {
        await updateCustomerAddress(payload);
      } else {
        await createCustomerAddress(payload);
      }
      await loadAddresses();
      resetAddressForm();
    } catch {
      setAddressesError("Failed to save address.");
    } finally {
      setAddressSaving(false);
    }
  }

  async function handleDeleteAddress(addressId) {
    const ok = window.confirm("Delete this address?");
    if (!ok) return;
    setAddressSaving(true);
    setAddressesError("");
    try {
      await deleteCustomerAddress(addressId);
      await loadAddresses();
      if (editingAddressId === addressId) {
        resetAddressForm();
      }
    } catch {
      setAddressesError("Failed to delete address.");
    } finally {
      setAddressSaving(false);
    }
  }

  // Still loading or redirect pending
  if (loading || !customer) {
    return (
      <>
        <Header />
        <main className={styles.page}>
          <div className={styles.loadingShell}>
            <div className={styles.spinner} />
            <p>Loading your account...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const firstName = customer.firstName || "";
  const lastName = customer.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Customer";
  const email = customer.emailAddress?.emailAddress || "";
  const phone =
    customer.phoneNumber?.phoneNumber ||
    customer.phoneNumber ||
    customer.phone ||
    "";
  const initials = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || email[0]?.toUpperCase() || "?";

  return (
    <>
      <Header />
      <main className={styles.page}>
        <div className={styles.shell}>

          {/* Hero card */}
          <div className={styles.heroCard}>
            <div className={styles.heroLeft}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.heroInfo}>
                <h1 className={styles.heroName}>{fullName}</h1>
                <p className={styles.heroEmail}>
                  <Mail size={13} />
                  {email}
                </p>
              </div>
            </div>
            <a href="/api/auth/shopify/logout" className={styles.logoutBtn}>
              <LogOut size={14} />
              Sign out
            </a>
          </div>

          {/* Stats row */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIconWrap}>
                <ShoppingBag size={19} className={styles.statIcon} />
              </div>
              <div className={styles.statCopy}>
                <span className={styles.statValue}>{orders.length}</span>
                <span className={styles.statLabel}>Total Orders</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIconWrap}>
                <CheckCircle size={19} className={styles.statIcon} />
              </div>
              <div className={styles.statCopy}>
                <span className={styles.statValue}>
                  {orders.filter(o => (o.fulfillmentStatus || "").toLowerCase() === "fulfilled").length}
                </span>
                <span className={styles.statLabel}>Delivered</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIconWrap}>
                <Truck size={19} className={styles.statIcon} />
              </div>
              <div className={styles.statCopy}>
                <span className={styles.statValue}>
                  {orders.filter(o => {
                    const s = (o.fulfillmentStatus || "").toLowerCase();
                    return s === "unfulfilled" || s === "in_progress" || s === "partial";
                  }).length}
                </span>
                <span className={styles.statLabel}>In Transit</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIconWrap}>
                <User size={19} className={styles.statIcon} />
              </div>
              <div className={styles.statCopy}>
                <span className={`${styles.statValue} ${styles.statTextValue}`}>Active</span>
                <span className={styles.statLabel}>Account</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={styles.tab}
              data-active={activeTab === "orders" ? "true" : "false"}
              onClick={() => setActiveTab("orders")}
            >
              <Package size={15} />
              Orders
            </button>
            <button
              className={styles.tab}
              data-active={activeTab === "details" ? "true" : "false"}
              onClick={() => setActiveTab("details")}
            >
              <User size={15} />
              My Details
            </button>
            <button
              className={styles.tab}
              data-active={activeTab === "addresses" ? "true" : "false"}
              onClick={() => setActiveTab("addresses")}
            >
              <MapPin size={15} />
              Addresses
            </button>
          </div>

          {/* Orders tab */}
          {activeTab === "orders" && (
            <div className={styles.tabContent}>
              {ordersLoading ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <p>Fetching your orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className={styles.emptyState}>
                  <ShoppingBag size={40} className={styles.emptyIcon} />
                  <h3>No orders yet</h3>
                  <p>Your order history will appear here once you make a purchase.</p>
                  <Link href="/" className={styles.shopBtn}>Browse Products</Link>
                </div>
              ) : (
                <div className={styles.ordersList}>
                  {orders.map((order) => (
                    <div key={order.id} className={styles.orderCard}>
                      <div className={styles.orderHeader}>
                        <div className={styles.orderMeta}>
                          <span className={styles.orderName}>{order.name}</span>
                          <span className={styles.orderDate}>
                            <Clock size={11} />
                            {formatDate(order.processedAt)}
                          </span>
                        </div>
                        <div className={styles.orderRight}>
                          <span className={styles.orderTotal}>
                            {formatMoney(order.totalPrice?.amount, order.totalPrice?.currencyCode)}
                          </span>
                          {order.statusPageUrl && (
                            <a
                              href={order.statusPageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.orderTrackBtn}
                            >
                              Track <ChevronRight size={13} />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className={styles.orderBadges}>
                        <StatusBadge status={order.financialStatus} />
                        <StatusBadge status={order.fulfillmentStatus} />
                      </div>

                      {order.lineItems.length > 0 && (
                        <div className={styles.lineItems}>
                          {order.lineItems.map((li, i) => (
                            <div key={i} className={styles.lineItem}>
                              {li.image?.url ? (
                                <img src={li.image.url} alt={li.image.altText || li.title} className={styles.lineItemImg} />
                              ) : (
                                <div className={styles.lineItemImgFallback}><Package size={14} /></div>
                              )}
                              <div className={styles.lineItemInfo}>
                                <span className={styles.lineItemTitle}>{li.title}</span>
                                <span className={styles.lineItemQty}>Qty: {li.quantity}</span>
                              </div>
                              <span className={styles.lineItemPrice}>
                                {formatMoney(li.price?.amount, li.price?.currencyCode)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Account details tab */}
          {activeTab === "details" && (
            <div className={styles.tabContent}>
              <div className={styles.detailsCard}>
                <h2 className={styles.detailsTitle}>Personal Information</h2>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailField}>
                    <label>First Name</label>
                    <span>{firstName || "--"}</span>
                  </div>
                  <div className={styles.detailField}>
                    <label>Last Name</label>
                    <span>{lastName || "--"}</span>
                  </div>
                  <div className={styles.detailField} style={{ gridColumn: "1 / -1" }}>
                    <label>Email Address</label>
                    <span>{email || "--"}</span>
                  </div>
                  <div className={styles.detailField} style={{ gridColumn: "1 / -1" }}>
                    <label>Phone Number</label>
                    <span>{phone || "-- Not added yet --"}</span>
                  </div>
                </div>

                <form className={styles.profileEditForm} onSubmit={handleProfileSave}>
                  <h3 className={styles.sectionHeading}>Edit Profile</h3>
                  <div className={styles.formGrid}>
                    <label className={styles.formField}>
                      <span>First Name</span>
                      <input
                        type="text"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="First name"
                      />
                    </label>
                    <label className={styles.formField}>
                      <span>Last Name</span>
                      <input
                        type="text"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Last name"
                      />
                    </label>
                    <label className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                      <span>Phone Number</span>
                      <input
                        type="tel"
                        value={profileForm.phoneNumber}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="Phone number"
                      />
                    </label>
                  </div>
                  <div className={styles.formActions}>
                    <button type="submit" className={styles.primaryActionBtn} disabled={profileSaving}>
                      <Save size={14} />
                      {profileSaving ? "Saving..." : "Save Profile"}
                    </button>
                    {profileError && <span className={styles.formError}>{profileError}</span>}
                    {!profileError && profileMessage && <span className={styles.formSuccess}>{profileMessage}</span>}
                  </div>
                </form>

                <p className={styles.detailsNote}>
                  You can still manage everything directly in your
                  <a href={customerAccountUrl} target="_blank" rel="noreferrer">
                    {" "}Shopify account page
                  </a>.
                </p>
              </div>
            </div>
          )}

          {/* Addresses tab */}
          {activeTab === "addresses" && (
            <div className={styles.tabContent}>
              <div className={styles.detailsCard}>
                <h2 className={styles.detailsTitle}>Manage Addresses</h2>
                <div className={styles.addressSection}>
                  <div className={styles.addressSectionHeader}>
                    <h3 className={styles.sectionHeading}>Your Addresses</h3>
                    <button type="button" className={styles.secondaryActionBtn} onClick={resetAddressForm}>
                      <Plus size={14} />
                      Add New
                    </button>
                  </div>

                  {addressesLoading ? (
                    <p className={styles.inlineHint}>Loading addresses...</p>
                  ) : addresses.length === 0 ? (
                    <p className={styles.inlineHint}>No addresses yet. Add your first address below.</p>
                  ) : (
                    <div className={styles.addressList}>
                      {addresses.map((address) => (
                        <article key={address.id} className={styles.addressCard}>
                          <div className={styles.addressTop}>
                            <div className={styles.addressTitleWrap}>
                              <MapPin size={14} />
                              <strong>{[address.firstName, address.lastName].filter(Boolean).join(" ") || "Address"}</strong>
                              {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
                            </div>
                            <div className={styles.addressActions}>
                              <button type="button" onClick={() => handleEditAddress(address)}>
                                <Pencil size={13} />
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteAddress(address.id)}>
                                <Trash2 size={13} />
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className={styles.addressText}>
                            {[
                              address.address1,
                              address.address2,
                              address.city,
                              address.zoneCode,
                              address.zip,
                              address.territoryCode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {address.phoneNumber && (
                            <p className={styles.addressSubText}>Phone: {address.phoneNumber}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}

                  <form className={styles.addressForm} onSubmit={handleAddressSubmit}>
                    <div className={styles.formGrid}>
                      <label className={styles.formField}>
                        <span>First Name</span>
                        <input
                          type="text"
                          value={addressForm.firstName}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, firstName: e.target.value }))}
                          placeholder="First name"
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>Last Name</span>
                        <input
                          type="text"
                          value={addressForm.lastName}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Last name"
                        />
                      </label>
                      <label className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                        <span>Address Line 1</span>
                        <input
                          type="text"
                          value={addressForm.address1}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, address1: e.target.value }))}
                          placeholder="Flat, house no., street"
                          required
                        />
                      </label>
                      <label className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                        <span>Address Line 2</span>
                        <input
                          type="text"
                          value={addressForm.address2}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, address2: e.target.value }))}
                          placeholder="Area, landmark (optional)"
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>City</span>
                        <input
                          type="text"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="City"
                          required
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>State / Province</span>
                        <input
                          type="text"
                          value={addressForm.zoneCode}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, zoneCode: e.target.value }))}
                          placeholder="State"
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>PIN Code</span>
                        <input
                          type="text"
                          value={addressForm.zip}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, zip: e.target.value }))}
                          placeholder="ZIP / PIN"
                          required
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>Country Code</span>
                        <input
                          type="text"
                          value={addressForm.territoryCode}
                          onChange={(e) =>
                            setAddressForm((prev) => ({
                              ...prev,
                              territoryCode: e.target.value.toUpperCase().slice(0, 2),
                            }))
                          }
                          placeholder="IN"
                          required
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>Phone Number</span>
                        <input
                          type="tel"
                          value={addressForm.phoneNumber}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                          placeholder="Phone number"
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>Company (optional)</span>
                        <input
                          type="text"
                          value={addressForm.company}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, company: e.target.value }))}
                          placeholder="Company"
                        />
                      </label>
                    </div>

                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={addressForm.defaultAddress}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, defaultAddress: e.target.checked }))}
                      />
                      <span>Set as default address</span>
                    </label>

                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryActionBtn} disabled={addressSaving}>
                        <Save size={14} />
                        {addressSaving
                          ? "Saving..."
                          : addressMode === "edit"
                            ? "Update Address"
                            : "Save Address"}
                      </button>
                      {addressMode === "edit" && (
                        <button type="button" className={styles.secondaryActionBtn} onClick={resetAddressForm}>
                          Cancel Edit
                        </button>
                      )}
                    </div>
                    {addressesError && <p className={styles.formError}>{addressesError}</p>}
                  </form>
                </div>

                <p className={styles.detailsNote}>
                  You can also manage addresses in your
                  <a href={customerAccountUrl} target="_blank" rel="noreferrer">
                    {" "}Shopify account page
                  </a>.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  );
}
