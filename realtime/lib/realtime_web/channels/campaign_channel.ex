defmodule RealtimeWeb.CampaignChannel do
  @moduledoc """
  Channel for campaign-specific events.

  Users can subscribe to campaign updates (progress, status changes).
  Authorization should be checked before allowing joins.
  """

  use Phoenix.Channel

  require Logger

  @impl true
  def join("campaign:" <> campaign_id, _params, socket) do
    # TODO: Verify user has access to this campaign via API call
    # For now, we allow joins and trust the frontend to only subscribe to allowed campaigns

    if valid_uuid?(campaign_id) do
      Logger.debug("User #{socket.assigns.user_id} joined campaign:#{campaign_id}")
      Phoenix.PubSub.subscribe(Realtime.PubSub, "campaign:#{campaign_id}")
      {:ok, assign(socket, :campaign_id, campaign_id)}
    else
      {:error, %{reason: "invalid_campaign_id"}}
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
