#include <napi.h>
#include "llama.h"
#include "ggml.h"
#include "llama_model.h"
#include "llama_context.h"
#include "llama_embedder.h"

static bool backend_initialized = false;

static void silent_log(enum ggml_log_level, const char*, void*) {}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  if (!backend_initialized) {
    llama_log_set(silent_log, nullptr);
    llama_backend_init();
    backend_initialized = true;
  }

  exports.Set("LlamaModel", LlamaModel::Init(env));
  exports.Set("LlamaContext", LlamaContext::Init(env));
  exports.Set("LlamaEmbedder", LlamaEmbedder::Init(env));
  return exports;
}

NODE_API_MODULE(brainer_llama, Init)
