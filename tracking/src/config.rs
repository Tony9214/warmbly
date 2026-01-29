use crate::aws::{SecretsManagerClient, SsmParameterStore};
use tracing::info;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub kafka_brokers: String,
    pub kafka_topic: String,
    pub kafka_sasl_username: Option<String>,
    pub kafka_sasl_password: Option<String>,
    pub schema_registry_url: String,
    pub schema_registry_key: Option<String>,
    pub schema_registry_secret: Option<String>,
}

impl Config {
    /// Load configuration from AWS Parameter Store and Secrets Manager
    pub async fn from_aws(env: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        info!("Loading configuration from AWS for environment: {}", env);

        let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let params = SsmParameterStore::new(&aws_config);
        let secrets = SecretsManagerClient::new(&aws_config);

        // Load from Parameter Store
        let kafka_brokers = params.get("kafka/bootstrap_servers").await?;
        info!("Loaded kafka/bootstrap_servers");

        let schema_registry_url = params.get("kafka/schema_registry/endpoint").await?;
        info!("Loaded kafka/schema_registry/endpoint");

        let kafka_topic = params
            .get_optional("kafka/tracking/topic")
            .await
            .unwrap_or_else(|| "tracking-events".to_string());
        info!("Kafka topic: {}", kafka_topic);

        let host = params
            .get_optional(&format!("/warmbly/{}/tracking/host", env))
            .await
            .unwrap_or_else(|| "0.0.0.0".to_string());

        let port: u16 = params
            .get_optional(&format!("/warmbly/{}/tracking/port", env))
            .await
            .unwrap_or_else(|| "3000".to_string())
            .parse()?;

        // Load from Secrets Manager
        let kafka_sasl_username = secrets.get_optional("kafka/sasl/username").await;
        let kafka_sasl_password = secrets.get_optional("kafka/sasl/password").await;
        let schema_registry_key = secrets.get_optional("kafka/schema_registry/key").await;
        let schema_registry_secret = secrets.get_optional("kafka/schema_registry/secret").await;

        if kafka_sasl_username.is_some() {
            info!("SASL authentication enabled");
        }
        if schema_registry_key.is_some() {
            info!("Schema Registry authentication enabled");
        }

        Ok(Self {
            host,
            port,
            kafka_brokers,
            kafka_topic,
            kafka_sasl_username,
            kafka_sasl_password,
            schema_registry_url,
            schema_registry_key,
            schema_registry_secret,
        })
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn sasl_enabled(&self) -> bool {
        self.kafka_sasl_username.is_some() && self.kafka_sasl_password.is_some()
    }

    pub fn schema_registry_auth(&self) -> Option<(String, String)> {
        match (&self.schema_registry_key, &self.schema_registry_secret) {
            (Some(key), Some(secret)) => Some((key.clone(), secret.clone())),
            _ => None,
        }
    }
}
