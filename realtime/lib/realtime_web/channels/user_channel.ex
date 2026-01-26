defmodule RealtimeWeb.UserChannel do
  @moduledoc """
  Channel for user-specific events.

  Users automatically join their personal channel on socket connection.
  Events include: email received, account status changes, bulk operation progress.
  """

  use Phoenix.Channel

  require Logger

  @impl true
  def join("user:" <> user_id, _params, socket) do
    # Users can only join their own channel
    if socket.assigns.user_id == user_id do
      Logger.debug("User #{user_id} joined user channel")
      send(self(), :after_join)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Subscribe to the user's Pub/Sub topic
    Phoenix.PubSub.subscribe(Realtime.PubSub, "user:#{socket.assigns.user_id}")
    {:noreply, socket}
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

  @impl true
  def terminate(_reason, socket) do
    Realtime.Connections.untrack(socket.assigns.user_id)
    :ok
  end
end
