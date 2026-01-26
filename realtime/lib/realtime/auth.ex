defmodule Realtime.Auth do
  @moduledoc """
  Token verification for WebSocket connections.

  Verifies JWT tokens issued by the Go backend.
  """

  require Logger

  @doc """
  Verifies a JWT token and returns the user_id if valid.
  """
  def verify_token(nil), do: {:error, :missing_token}
  def verify_token(""), do: {:error, :missing_token}

  def verify_token(token) do
    secret = Application.get_env(:realtime, :jwt_secret)

    case JOSE.JWT.verify_strict(jwk(secret), ["HS256"], token) do
      {true, %JOSE.JWT{fields: fields}, _} ->
        validate_claims(fields)

      {false, _, _} ->
        {:error, :invalid_signature}

      {:error, reason} ->
        Logger.warning("JWT verification failed: #{inspect(reason)}")
        {:error, :verification_failed}
    end
  rescue
    e ->
      Logger.error("JWT verification error: #{inspect(e)}")
      Sentry.capture_exception(e)
      {:error, :verification_error}
  end

  defp jwk(secret) do
    JOSE.JWK.from_oct(secret)
  end

  defp validate_claims(%{"sub" => user_id, "exp" => exp}) do
    now = System.system_time(:second)

    cond do
      is_nil(user_id) or user_id == "" ->
        {:error, :missing_subject}

      exp < now ->
        {:error, :token_expired}

      true ->
        {:ok, user_id}
    end
  end

  defp validate_claims(%{"user_id" => user_id, "exp" => exp}) do
    validate_claims(%{"sub" => user_id, "exp" => exp})
  end

  defp validate_claims(_) do
    {:error, :invalid_claims}
  end
end
