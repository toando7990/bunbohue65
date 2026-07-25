import { useGetOrderForTracking } from "@/hooks/useBackend";
import { useSearch } from "@tanstack/react-router";

function OrderTrackingPage() {
  const search = useSearch({ strict: false }) as {
    orderId?: string;
  };
  const orderId =
    search.orderId != null && search.orderId.trim() !== ""
      ? BigInt(search.orderId)
      : undefined;

  const { data, isLoading, isError } = useGetOrderForTracking(orderId);

  if (orderId === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="max-w-md text-center text-foreground">
          Vui lòng sử dụng link theo dõi đơn hàng của bạn.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-muted-foreground">Đang tải thông tin đơn hàng...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="max-w-md text-center text-foreground">
          Không tìm thấy đơn hàng.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Theo dõi đơn hàng
        </h1>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Mã đơn</dt>
            <dd className="text-foreground">{data.orderId.toString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Trạng thái đơn</dt>
            <dd className="text-foreground">{data.orderStatus}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Trạng thái giao</dt>
            <dd className="text-foreground">{data.shippingStatus}</dd>
          </div>
          {data.shipperName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipper</dt>
              <dd className="text-foreground">{data.shipperName}</dd>
            </div>
          )}
          {data.shipperPhone && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd className="text-foreground">{data.shipperPhone}</dd>
            </div>
          )}
          {data.paymentStatus && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Thanh toán</dt>
              <dd className="text-foreground">{data.paymentStatus}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

export default OrderTrackingPage;
