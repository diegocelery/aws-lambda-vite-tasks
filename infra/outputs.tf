output "function_url" {
  description = "URL pública de la Lambda (Function URL). La consume el frontend como VITE_API_URL."
  value       = aws_lambda_function_url.tasks_api.function_url
}

output "table_name" {
  description = "Nombre de la tabla DynamoDB"
  value       = aws_dynamodb_table.tasks.name
}
