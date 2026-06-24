data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/build/lambda.zip"
}

resource "aws_lambda_function" "tasks_api" {
  function_name    = var.function_name
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  architectures    = ["arm64"]
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.tasks.name
    }
  }
}

# Acceso público mediante Lambda Function URL (authorization_type = NONE).
#
# Desde oct-2025 una Function URL pública requiere DOS permisos para el principal "*":
#   - lambda:InvokeFunctionUrl
#   - lambda:InvokeFunction
# Con solo el primero (modelo antiguo) la URL devuelve 403 AccessDeniedException.
resource "aws_lambda_permission" "function_url_invoke_url" {
  statement_id           = "AllowPublicInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.tasks_api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "function_url_invoke" {
  statement_id  = "AllowPublicInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tasks_api.function_name
  principal     = "*"
  # function_url_auth_type solo es válido con lambda:InvokeFunctionUrl, no aquí.
}

resource "aws_lambda_function_url" "tasks_api" {
  function_name      = aws_lambda_function.tasks_api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE"]
    allow_headers = ["content-type"]
    max_age       = 86400
  }
}
