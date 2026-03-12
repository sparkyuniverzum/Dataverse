import AppConnectivityNotice from "./AppConnectivityNotice";

export default function SessionBootScreen({ connectivityNotice = null }) {
  return (
    <>
      <AppConnectivityNotice notice={connectivityNotice} />
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#02050c",
          color: "#d8f8ff",
        }}
      >
        Ověřuji relaci...
      </div>
    </>
  );
}
