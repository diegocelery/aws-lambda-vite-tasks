variable "aws_region" {
  description = "Región de AWS donde se despliegan los recursos"
  type        = string
  default     = "us-east-2"
}

variable "aws_profile" {
  description = "Perfil de AWS CLI a usar"
  type        = string
  default     = "iamaster"
}

variable "table_name" {
  description = "Nombre de la tabla DynamoDB de tareas"
  type        = string
  default     = "tasks"
}

variable "function_name" {
  description = "Nombre de la función Lambda"
  type        = string
  default     = "tasks-api"
}
