defmodule Realtime.Connections do
  @moduledoc """
  Tracks active WebSocket connections per user.

  Uses ETS for fast lookups and counts.
  """

  use GenServer

  require Logger

  @table :realtime_connections
  @max_connections_per_user 10

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Track a new connection for a user.
  Returns :ok if allowed, {:error, :limit_exceeded} if too many connections.
  """
  def track(user_id) do
    GenServer.call(__MODULE__, {:track, user_id})
  end

  @doc """
  Untrack a connection for a user.
  """
  def untrack(user_id) do
    GenServer.cast(__MODULE__, {:untrack, user_id})
  end

  @doc """
  Get connection count for a user.
  """
  def count(user_id) do
    case :ets.lookup(@table, user_id) do
      [{^user_id, count}] -> count
      [] -> 0
    end
  end

  @doc """
  Get connection statistics.
  """
  def stats do
    total_users = :ets.info(@table, :size)

    total_connections =
      :ets.foldl(fn {_, count}, acc -> acc + count end, 0, @table)

    %{
      total_users: total_users,
      total_connections: total_connections,
      max_per_user: @max_connections_per_user
    }
  end

  # Server callbacks

  @impl true
  def init(_) do
    :ets.new(@table, [:named_table, :public, :set])
    Logger.info("Connections tracker started")
    {:ok, %{}}
  end

  @impl true
  def handle_call({:track, user_id}, _from, state) do
    current = count(user_id)

    if current >= @max_connections_per_user do
      {:reply, {:error, :limit_exceeded}, state}
    else
      :ets.update_counter(@table, user_id, {2, 1}, {user_id, 0})
      {:reply, :ok, state}
    end
  end

  @impl true
  def handle_cast({:untrack, user_id}, state) do
    case :ets.lookup(@table, user_id) do
      [{^user_id, count}] when count > 1 ->
        :ets.update_counter(@table, user_id, {2, -1})

      [{^user_id, _}] ->
        :ets.delete(@table, user_id)

      [] ->
        :ok
    end

    {:noreply, state}
  end
end
