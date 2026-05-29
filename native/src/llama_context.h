#pragma once
#include <napi.h>
#include "llama.h"

class LlamaContext : public Napi::ObjectWrap<LlamaContext> {
public:
  static Napi::Function Init(Napi::Env env);
  static Napi::Object Create(Napi::Env env, llama_model* model, int context_size);
  LlamaContext(const Napi::CallbackInfo& info);
  ~LlamaContext();

private:
  Napi::Value Generate(const Napi::CallbackInfo& info);
  Napi::Value ApplyChatTemplate(const Napi::CallbackInfo& info);
  Napi::Value Dispose(const Napi::CallbackInfo& info);

  llama_context* ctx_ = nullptr;
  llama_model* model_ = nullptr;
  static Napi::FunctionReference constructor_;
};
