defmodule RealtimeWeb.AccountChannel do
  @moduledoc """
  Channel for email account-specific events.

  Users can subscribe to email account updates (sync status, errors, warmup progress).
  """

  use Phoenix.Channel

  require Logger

  @impl true
  def join("account:" <> account_id, _params, socket) do
    # TODO: Verify user owns this email account via API call

    if valid_uuid?(account_id) do
      Logger.debug("User #{socket.assigns.user_id} joined account:#{account_id}")
      Phoenix.PubSub.subscribe(Realtime.PubSub, "account:#{account_id}")
      {:ok, assign(socket, :account_id, account_id)}
    else
      {:error, %{reason: "invalid_account_id"}}
    end
  end

  @impl true
  def handle_info({:pubsub_event, event}, socket) do
    push(socket, event["event_type"], event)
    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: System.system_time(:millisecond)}}, socket}
  end

  defp valid_uuid?(id) do
    case UUID.info(id) do
      {:ok, _} -> true
      _ -> false
    end
  end
end
