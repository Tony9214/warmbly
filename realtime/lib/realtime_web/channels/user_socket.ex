defmodule RealtimeWeb.UserSocket do
  use Phoenix.Socket

  require Logger

  # Channels
  channel "user:*", RealtimeWeb.UserChannel
  channel "campaign:*", RealtimeWeb.CampaignChannel
  channel "account:*", RealtimeWeb.AccountChannel
  channel "bulk:*", RealtimeWeb.BulkChannel

  @impl true
  def connect(%{"token" => token}, socket, connect_info) do
    case Realtime.Auth.verify_token(token) do
      {:ok, user_id} ->
        Logger.debug("Socket connected for user: #{user_id}")

        socket =
          socket
          |> assign(:user_id, user_id)
          |> assign(:ip_address, get_ip(connect_info))

        # Track connection
        Realtime.Connections.track(user_id)

        {:ok, socket}

      {:error, reason} ->
        Logger.warning("Socket connection rejected: #{inspect(reason)}")
        :error
    end
  end

  def connect(_params, _socket, _connect_info) do
    Logger.warning("Socket connection rejected: missing token")
    :error
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"

  defp get_ip(%{peer_data: %{address: address}}) do
    address |> :inet.ntoa() |> to_string()
  end

  defp get_ip(%{x_headers: headers}) do
    headers
    |> Enum.find(fn {key, _} -> key == "x-forwarded-for" end)
    |> case do
      {_, ip} -> ip |> String.split(",") |> List.first() |> String.trim()
      nil -> "unknown"
    end
  end

  defp get_ip(_), do: "unknown"
end
