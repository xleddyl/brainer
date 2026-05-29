#include "llama_context.h"
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>

Napi::FunctionReference LlamaContext::constructor_;

struct GenerateParams {
  std::string prompt;
  float temperature = 0.7f;
  float top_p = 0.9f;
  int32_t top_k = 40;
  float repeat_penalty = 1.1f;
  uint32_t seed = LLAMA_DEFAULT_SEED;
  int32_t max_tokens = -1;
  std::vector<std::string> stop_strings;
};

// Check if any stop string fully appears in the tail of the buffer.
// Returns the position where the stop string starts, or std::string::npos.
static size_t find_stop_string(const std::string& buf,
                               const std::vector<std::string>& stops) {
  for (const auto& stop : stops) {
    if (stop.empty()) continue;
    auto pos = buf.find(stop);
    if (pos != std::string::npos) return pos;
  }
  return std::string::npos;
}

// Check if the tail of the buffer is a partial prefix of any stop string.
// Returns the length of the longest partial match at the end of buf, or 0.
static size_t partial_stop_match(const std::string& buf,
                                 const std::vector<std::string>& stops) {
  size_t best = 0;
  for (const auto& stop : stops) {
    if (stop.empty()) continue;
    size_t max_check = std::min(buf.size(), stop.size() - 1);
    for (size_t len = 1; len <= max_check; len++) {
      if (buf.compare(buf.size() - len, len, stop, 0, len) == 0) {
        best = std::max(best, len);
      }
    }
  }
  return best;
}

class GenerateWorker : public Napi::AsyncWorker {
public:
  GenerateWorker(Napi::Env env, llama_context* ctx, llama_model* model,
                 GenerateParams params, Napi::ThreadSafeFunction tsfn)
    : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)),
      ctx_(ctx), model_(model), params_(std::move(params)), tsfn_(tsfn) {}

  Napi::Promise Promise() { return deferred_.Promise(); }

  void Execute() override {
    const auto* vocab = llama_model_get_vocab(model_);
    const bool has_stops = !params_.stop_strings.empty();

    // Tokenize
    int n_prompt = -llama_tokenize(vocab, params_.prompt.c_str(),
                                    params_.prompt.size(), nullptr, 0, true, true);
    std::vector<llama_token> tokens(n_prompt);
    llama_tokenize(vocab, params_.prompt.c_str(), params_.prompt.size(),
                   tokens.data(), tokens.size(), true, true);

    // Create sampler chain
    auto sparams = llama_sampler_chain_default_params();
    llama_sampler* smpl = llama_sampler_chain_init(sparams);

    if (params_.repeat_penalty != 1.0f) {
      llama_sampler_chain_add(smpl, llama_sampler_init_penalties(
        64, params_.repeat_penalty, 0.0f, 0.0f));
    }
    if (params_.top_k > 0) {
      llama_sampler_chain_add(smpl, llama_sampler_init_top_k(params_.top_k));
    }
    if (params_.top_p < 1.0f) {
      llama_sampler_chain_add(smpl, llama_sampler_init_top_p(params_.top_p, 1));
    }
    if (params_.temperature > 0.0f) {
      llama_sampler_chain_add(smpl, llama_sampler_init_temp(params_.temperature));
      llama_sampler_chain_add(smpl, llama_sampler_init_dist(params_.seed));
    } else {
      llama_sampler_chain_add(smpl, llama_sampler_init_greedy());
    }

    // Decode prompt
    auto batch = llama_batch_get_one(tokens.data(), tokens.size());
    if (llama_decode(ctx_, batch) != 0) {
      SetError("Failed to decode prompt");
      llama_sampler_free(smpl);
      return;
    }

    // Generate tokens
    int max_tokens = params_.max_tokens > 0 ? params_.max_tokens : 4096;
    char piece_buf[128];

    // Buffer for stop string detection — holds text that might be a partial
    // stop string prefix and hasn't been emitted yet.
    std::string pending;

    for (int i = 0; i < max_tokens; i++) {
      llama_token new_token = llama_sampler_sample(smpl, ctx_, -1);

      if (llama_vocab_is_eog(vocab, new_token)) break;
      if (llama_vocab_is_control(vocab, new_token)) break;

      llama_sampler_accept(smpl, new_token);

      int n = llama_token_to_piece(vocab, new_token, piece_buf, sizeof(piece_buf), 0, false);
      if (n <= 0) goto next_decode;

      if (!has_stops) {
        // No stop strings — emit directly
        std::string piece(piece_buf, n);
        result_ += piece;
        if (tsfn_) {
          auto* chunk = new std::string(piece);
          tsfn_.BlockingCall(chunk, [](Napi::Env env, Napi::Function cb, std::string* data) {
            cb.Call({ Napi::String::New(env, *data) });
            delete data;
          });
        }
      } else {
        // Append to pending buffer and check for stop strings
        pending.append(piece_buf, n);

        // Full stop string found — truncate and stop
        size_t stop_pos = find_stop_string(pending, params_.stop_strings);
        if (stop_pos != std::string::npos) {
          std::string safe = pending.substr(0, stop_pos);
          if (!safe.empty()) {
            result_ += safe;
            if (tsfn_) {
              auto* chunk = new std::string(safe);
              tsfn_.BlockingCall(chunk, [](Napi::Env env, Napi::Function cb, std::string* data) {
                cb.Call({ Napi::String::New(env, *data) });
                delete data;
              });
            }
          }
          goto done;
        }

        // Check if tail of pending is a partial prefix of a stop string
        size_t partial = partial_stop_match(pending, params_.stop_strings);
        if (partial > 0) {
          // Emit everything except the partial match
          std::string safe = pending.substr(0, pending.size() - partial);
          if (!safe.empty()) {
            result_ += safe;
            if (tsfn_) {
              auto* chunk = new std::string(safe);
              tsfn_.BlockingCall(chunk, [](Napi::Env env, Napi::Function cb, std::string* data) {
                cb.Call({ Napi::String::New(env, *data) });
                delete data;
              });
            }
          }
          pending = pending.substr(pending.size() - partial);
        } else {
          // No partial match — emit everything
          result_ += pending;
          if (tsfn_) {
            auto* chunk = new std::string(pending);
            tsfn_.BlockingCall(chunk, [](Napi::Env env, Napi::Function cb, std::string* data) {
              cb.Call({ Napi::String::New(env, *data) });
              delete data;
            });
          }
          pending.clear();
        }
      }

      next_decode:
      auto next_batch = llama_batch_get_one(&new_token, 1);
      if (llama_decode(ctx_, next_batch) != 0) {
        SetError("Failed to decode token");
        break;
      }
    }

    done:
    // If generation ended normally (not by stop string), flush any remaining
    // pending text — it was held back speculatively but turned out to be safe.
    if (!pending.empty()) {
      result_ += pending;
      if (tsfn_) {
        auto* chunk = new std::string(pending);
        tsfn_.BlockingCall(chunk, [](Napi::Env env, Napi::Function cb, std::string* data) {
          cb.Call({ Napi::String::New(env, *data) });
          delete data;
        });
      }
    }

    llama_sampler_free(smpl);
    if (tsfn_) tsfn_.Release();
  }

  void OnOK() override {
    deferred_.Resolve(Napi::String::New(Env(), result_));
  }

  void OnError(const Napi::Error& err) override {
    if (tsfn_) tsfn_.Release();
    deferred_.Reject(err.Value());
  }

private:
  Napi::Promise::Deferred deferred_;
  llama_context* ctx_;
  llama_model* model_;
  GenerateParams params_;
  Napi::ThreadSafeFunction tsfn_;
  std::string result_;
};

Napi::Function LlamaContext::Init(Napi::Env env) {
  auto func = DefineClass(env, "LlamaContext", {
    InstanceMethod("generate", &LlamaContext::Generate),
    InstanceMethod("applyChatTemplate", &LlamaContext::ApplyChatTemplate),
    InstanceMethod("dispose", &LlamaContext::Dispose),
  });
  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();
  return func;
}

Napi::Object LlamaContext::Create(Napi::Env env, llama_model* model, int context_size) {
  auto obj = constructor_.New({});
  auto* wrapper = Napi::ObjectWrap<LlamaContext>::Unwrap(obj);
  wrapper->model_ = model;

  auto params = llama_context_default_params();
  params.n_ctx = context_size;
  params.n_batch = 2048;
  params.embeddings = false;

  wrapper->ctx_ = llama_init_from_model(model, params);
  if (!wrapper->ctx_) {
    Napi::Error::New(env, "Failed to create context").ThrowAsJavaScriptException();
  }
  return obj;
}

LlamaContext::LlamaContext(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<LlamaContext>(info) {}

LlamaContext::~LlamaContext() {
  if (ctx_) {
    llama_free(ctx_);
    ctx_ = nullptr;
  }
}

Napi::Value LlamaContext::Generate(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (!ctx_) {
    Napi::Error::New(env, "Context disposed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto opts = info[0].As<Napi::Object>();
  GenerateParams params;
  params.prompt = opts.Get("prompt").As<Napi::String>().Utf8Value();

  auto get_float = [&](const char* key, float def) -> float {
    if (opts.Has(key) && opts.Get(key).IsNumber())
      return opts.Get(key).As<Napi::Number>().FloatValue();
    return def;
  };
  auto get_int = [&](const char* key, int32_t def) -> int32_t {
    if (opts.Has(key) && opts.Get(key).IsNumber())
      return opts.Get(key).As<Napi::Number>().Int32Value();
    return def;
  };
  auto get_uint = [&](const char* key, uint32_t def) -> uint32_t {
    if (opts.Has(key) && opts.Get(key).IsNumber())
      return opts.Get(key).As<Napi::Number>().Uint32Value();
    return def;
  };

  params.temperature = get_float("temperature", params.temperature);
  params.top_p = get_float("topP", params.top_p);
  params.top_k = get_int("topK", params.top_k);
  params.repeat_penalty = get_float("repeatPenalty", params.repeat_penalty);
  params.seed = get_uint("seed", params.seed);
  params.max_tokens = get_int("maxTokens", params.max_tokens);

  if (opts.Has("stopStrings")) {
    auto val = opts.Get("stopStrings");
    if (val.IsArray()) {
      auto arr = val.As<Napi::Array>();
      for (uint32_t i = 0; i < arr.Length(); i++) {
        auto item = arr.Get(i);
        if (item.IsString()) {
          params.stop_strings.push_back(item.As<Napi::String>().Utf8Value());
        }
      }
    }
  }

  Napi::ThreadSafeFunction tsfn = nullptr;
  if (opts.Has("onToken")) {
    auto val = opts.Get("onToken");
    if (val.IsFunction()) {
      tsfn = Napi::ThreadSafeFunction::New(env, val.As<Napi::Function>(), "onToken", 0, 1);
    }
  }

  llama_memory_clear(llama_get_memory(ctx_), true);

  auto worker = new GenerateWorker(env, ctx_, model_, params, tsfn);
  auto promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Value LlamaContext::ApplyChatTemplate(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto messages = info[0].As<Napi::Array>();
  bool add_ass = info.Length() > 1 ? info[1].As<Napi::Boolean>().Value() : true;

  std::vector<llama_chat_message> chat_msgs;
  std::vector<std::string> roles, contents;
  uint32_t len = messages.Length();

  roles.reserve(len);
  contents.reserve(len);

  for (uint32_t i = 0; i < len; i++) {
    auto msg = messages.Get(i).As<Napi::Object>();
    roles.push_back(msg.Get("role").As<Napi::String>().Utf8Value());
    contents.push_back(msg.Get("content").As<Napi::String>().Utf8Value());
  }

  for (uint32_t i = 0; i < len; i++) {
    chat_msgs.push_back({ roles[i].c_str(), contents[i].c_str() });
  }

  // Try the model's built-in Jinja template first
  const char* tmpl = llama_model_chat_template(model_, nullptr);
  int32_t size = llama_chat_apply_template(
    tmpl, chat_msgs.data(), chat_msgs.size(), add_ass, nullptr, 0);

  // If Jinja template fails, try architecture name as template identifier
  // (e.g. "gemma" maps to a built-in template in llama.cpp)
  std::string arch_tmpl;
  if (size < 0) {
    char desc[256];
    llama_model_desc(model_, desc, sizeof(desc));
    arch_tmpl = std::string(desc);
    // llama_model_desc returns e.g. "gemma2 4B Q4_K_M" — extract first word
    auto sp = arch_tmpl.find(' ');
    if (sp != std::string::npos) arch_tmpl = arch_tmpl.substr(0, sp);
    // strip trailing digits for family name (e.g. "gemma2" -> "gemma")
    while (!arch_tmpl.empty() && std::isdigit(arch_tmpl.back()))
      arch_tmpl.pop_back();

    if (!arch_tmpl.empty()) {
      size = llama_chat_apply_template(
        arch_tmpl.c_str(), chat_msgs.data(), chat_msgs.size(), add_ass, nullptr, 0);
    }
  }

  if (size < 0) {
    // Final fallback to ChatML
    std::string result;
    for (uint32_t i = 0; i < len; i++) {
      result += "<|im_start|>" + roles[i] + "\n" + contents[i] + "<|im_end|>\n";
    }
    if (add_ass) result += "<|im_start|>assistant\n";
    return Napi::String::New(env, result);
  }

  const char* effective_tmpl = (size >= 0 && !arch_tmpl.empty()) ? arch_tmpl.c_str() : tmpl;

  std::vector<char> buf(size + 1);
  llama_chat_apply_template(
    effective_tmpl, chat_msgs.data(), chat_msgs.size(), add_ass, buf.data(), buf.size());
  buf[size] = '\0';

  return Napi::String::New(env, buf.data(), size);
}

Napi::Value LlamaContext::Dispose(const Napi::CallbackInfo& info) {
  if (ctx_) {
    llama_free(ctx_);
    ctx_ = nullptr;
  }
  return info.Env().Undefined();
}
