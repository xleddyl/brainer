#pragma once
#include <napi.h>
#include "llama.h"

class LlamaEmbedder : public Napi::ObjectWrap<LlamaEmbedder> {
public:
  static Napi::Function Init(Napi::Env env);
  static Napi::Object Create(Napi::Env env, llama_model* model);
  LlamaEmbedder(const Napi::CallbackInfo& info);
  ~LlamaEmbedder();

private:
  Napi::Value Embed(const Napi::CallbackInfo& info);
  Napi::Value Dispose(const Napi::CallbackInfo& info);

  llama_context* ctx_ = nullptr;
  llama_model* model_ = nullptr;
  static Napi::FunctionReference constructor_;
};
