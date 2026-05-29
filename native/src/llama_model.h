#pragma once
#include <napi.h>
#include "llama.h"

class LlamaModel : public Napi::ObjectWrap<LlamaModel> {
public:
  static Napi::Function Init(Napi::Env env);
  LlamaModel(const Napi::CallbackInfo& info);
  ~LlamaModel();

  llama_model* Model() const { return model_; }

private:
  Napi::Value Load(const Napi::CallbackInfo& info);
  Napi::Value CreateContext(const Napi::CallbackInfo& info);
  Napi::Value CreateEmbedder(const Napi::CallbackInfo& info);
  Napi::Value EmbeddingDimensions(const Napi::CallbackInfo& info);
  Napi::Value Dispose(const Napi::CallbackInfo& info);

  llama_model* model_ = nullptr;
  static Napi::FunctionReference constructor_;

  friend class LoadModelWorker;
};
