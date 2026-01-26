defmodule Realtime.Application do
  @moduledoc false

  use Application

  require Logger

  @impl true
  def start(_type, _args) do
    children = [
      # Phoenix PubSub for internal message broadcasting
      {Phoenix.PubSub, name: Realtime.PubSub},

      # Phoenix Endpoint (WebSocket server)
      RealtimeWeb.Endpoint,

      # Connection tracker
      {Realtime.Connections, []},

      # Google Pub/Sub subscriber supervisor
      {Realtime.PubSub.Supervisor, []}
    ]

    opts = [strategy: :one_for_one, name: Realtime.Supervisor]

    Logger.info("Starting Realtime application...")
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    RealtimeWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
