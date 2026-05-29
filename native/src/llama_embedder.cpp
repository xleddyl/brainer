#include "llama_embedder.h"
#include <vector>
#include <string>
#include <cmath>

Napi::FunctionReference LlamaEmbedder::constructor_;

class EmbedWorker : public Napi::AsyncWorker {
public:
  EmbedWorker(Napi::Env env, llama_context* ctx, llama_model* model, std::string text)
    : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)),
      ctx_(ctx), model_(model), text_(std::move(text)) {}

  Napi::Promise Promise() { return deferred_.Promise(); }

  void Execute() override {
    const auto* vocab = llama_model_get_vocab(model_);
    int n_embd = llama_model_n_embd(model_);

    // Tokenize
    int n_tokens = -llama_tokenize(vocab, text_.c_str(), text_.size(), nullptr, 0, true, true);
    std::vector<llama_token> tokens(n_tokens);
    llama_tokenize(vocab, text_.c_str(), text_.size(),
                   tokens.data(), tokens.size(), true, true);

    llama_memory_clear(llama_get_memory(ctx_), true);

    // Decode
    auto batch = llama_batch_get_one(tokens.data(), tokens.size());
    if (llama_decode(ctx_, batch) != 0) {
      SetError("Failed to decode for embeddings");
      return;
    }

    // Extract embeddings
    float* emb = llama_get_embeddings_seq(ctx_, 0);
    if (!emb) {
      emb = llama_get_embeddings(ctx_);
    }
    if (!emb) {
      SetError("Failed to get embeddings");
      return;
    }

    // L2 normalize
    embeddings_.resize(n_embd);
    float norm = 0.0f;
    for (int i = 0; i < n_embd; i++) norm += emb[i] * emb[i];
    norm = std::sqrt(norm);
    if (norm > 0.0f) {
      for (int i = 0; i < n_embd; i++) embeddings_[i] = emb[i] / norm;
    } else {
      for (int i = 0; i < n_embd; i++) embeddings_[i] = emb[i];
    }
  }

  void OnOK() override {
    auto env = Env();
    auto buf = Napi::Float32Array::New(env, embeddings_.size());
    memcpy(buf.Data(), embeddings_.data(), embeddings_.size() * sizeof(float));
    deferred_.Resolve(buf);
  }

  void OnError(const Napi::Error& err) override {
    deferred_.Reject(err.Value());
  }

private:
  Napi::Promise::Deferred deferred_;
  llama_context* ctx_;
  llama_model* model_;
  std::string text_;
  std::vector<float> embeddings_;
};

Napi::Function LlamaEmbedder::Init(Napi::Env env) {
  auto func = DefineClass(env, "LlamaEmbedder", {
    InstanceMethod("embed", &LlamaEmbedder::Embed),
    InstanceMethod("dispose", &LlamaEmbedder::Dispose),
  });
  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();
  return func;
}

Napi::Object LlamaEmbedder::Create(Napi::Env env, llama_model* model) {
  auto obj = constructor_.New({});
  auto* wrapper = Napi::ObjectWrap<LlamaEmbedder>::Unwrap(obj);
  wrapper->model_ = model;

  auto params = llama_context_default_params();
  params.n_ctx = 0;
  params.n_batch = 2048;
  params.embeddings = true;
  params.pooling_type = LLAMA_POOLING_TYPE_MEAN;

  wrapper->ctx_ = llama_init_from_model(model, params);
  if (!wrapper->ctx_) {
    Napi::Error::New(env, "Failed to create embedding context").ThrowAsJavaScriptException();
  }
  return obj;
}

LlamaEmbedder::LlamaEmbedder(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<LlamaEmbedder>(info) {}

LlamaEmbedder::~LlamaEmbedder() {
  if (ctx_) {
    llama_free(ctx_);
    ctx_ = nullptr;
  }
}

Napi::Value LlamaEmbedder::Embed(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (!ctx_) {
    Napi::Error::New(env, "Embedder disposed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto text = info[0].As<Napi::String>().Utf8Value();
  auto worker = new EmbedWorker(env, ctx_, model_, std::move(text));
  auto promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Value LlamaEmbedder::Dispose(const Napi::CallbackInfo& info) {
  if (ctx_) {
    llama_free(ctx_);
    ctx_ = nullptr;
  }
  return info.Env().Undefined();
}
